const { preprocessAnswer } = require('../services/nlp.service');
const { buildExactCacheKey } = require('../utils/hash.util');
const {
  getExactCacheId,
  setExactCacheId,
  getEmbeddingCache,
  setEmbeddingCache,
} = require('../services/cache.service');
const { generateMockEmbedding, embeddingToPgVectorLiteral } = require('../services/embedding.service');
const { evaluateWithAI } = require('../services/evaluation.service');
const answersRepo = require('../repositories/answers.repository');

const SEMANTIC_THRESHOLD = 0.25;

function validateBody(body) {
  const { curso_id, modulo_id, pregunta_id, respuesta } = body ?? {};
  if (
    curso_id == null ||
    modulo_id == null ||
    pregunta_id == null ||
    typeof respuesta !== 'string' ||
    !respuesta.trim()
  ) {
    const err = new Error(
      'Body inválido: se requieren curso_id, modulo_id, pregunta_id (numéricos) y respuesta (string no vacía)'
    );
    err.statusCode = 400;
    throw err;
  }
  // En la plataforma real estos IDs pueden ser UUID (string). Los tratamos como string para DB/cache.
  const cursoId = String(curso_id).trim();
  const moduloId = String(modulo_id).trim();
  const preguntaId = String(pregunta_id).trim();
  if (!cursoId || !moduloId || !preguntaId) {
    const err = new Error('curso_id, modulo_id y pregunta_id no pueden ser vacíos');
    err.statusCode = 400;
    throw err;
  }
  return { cursoId, moduloId, preguntaId, respuesta: respuesta.trim() };
}

function validateStoreBody(body) {
  const { curso_id, modulo_id, pregunta_id, respuesta, resultado } = body ?? {};
  if (
    curso_id == null ||
    modulo_id == null ||
    pregunta_id == null ||
    typeof respuesta !== 'string' ||
    !respuesta.trim()
  ) {
    const err = new Error(
      'Body inválido: se requieren curso_id, modulo_id, pregunta_id (numéricos) y respuesta (string no vacía)'
    );
    err.statusCode = 400;
    throw err;
  }
  const cursoId = String(curso_id).trim();
  const moduloId = String(modulo_id).trim();
  const preguntaId = String(pregunta_id).trim();
  if (!cursoId || !moduloId || !preguntaId) {
    const err = new Error('curso_id, modulo_id y pregunta_id no pueden ser vacíos');
    err.statusCode = 400;
    throw err;
  }
  if (resultado == null || typeof resultado !== 'object' || Array.isArray(resultado)) {
    const err = new Error('Body inválido: resultado debe ser un objeto JSON');
    err.statusCode = 400;
    throw err;
  }
  return { cursoId, moduloId, preguntaId, respuesta: respuesta.trim(), resultado };
}

async function postEvaluate(req, res, next) {
  try {
    const { cursoId, moduloId, preguntaId, respuesta } = validateBody(req.body);

    const { respuestaNormalizada, keywords, entidades } = preprocessAnswer(respuesta);
    const hash = buildExactCacheKey(cursoId, moduloId, preguntaId, respuestaNormalizada);

    const cachedId = await getExactCacheId(hash);
    if (cachedId != null) {
      console.log('[evaluate] cache hit (exact)', { hash: hash.slice(0, 12), id: cachedId });
      const row = await answersRepo.findById(cachedId);
      if (row?.resultado_ia) {
        return res.json({
          resultado: row.resultado_ia,
          source: 'cache_exact',
        });
      }
      console.log('[evaluate] exact cache apuntaba a id inexistente; continúo sin caché exacto');
    } else {
      console.log('[evaluate] cache miss (exact)', { hash: hash.slice(0, 12) });
    }

    let embedding = await getEmbeddingCache(hash);
    if (embedding) {
      console.log('[evaluate] embedding reutilizado desde Redis');
    } else {
      embedding = generateMockEmbedding(`${hash}:emb`);
      await setEmbeddingCache(hash, embedding);
      console.log('[evaluate] embedding generado (mock) y guardado en Redis');
    }
    const embeddingLiteral = embeddingToPgVectorLiteral(embedding);

    const nearest = await answersRepo.semanticSearchNearest(
      cursoId,
      moduloId,
      preguntaId,
      embeddingLiteral,
      3
    );
    const best = nearest[0];
    const bestDist = best ? Number(best.distance) : null;

    if (best && bestDist < SEMANTIC_THRESHOLD) {
      console.log('[evaluate] semantic hit', { id: best.id, distance: bestDist });
      await setExactCacheId(hash, best.id);
      return res.json({
        resultado: best.resultado_ia,
        source: 'cache_semantic',
      });
    }
    console.log('[evaluate] semantic miss', { bestDistance: bestDist, rows: nearest.length });

    const resultado = evaluateWithAI(respuesta);
    console.log('[evaluate] IA fallback (mock)');

    const newId = await answersRepo.insertAnswerRow({
      cursoId,
      moduloId,
      preguntaId,
      respuestaOriginal: respuesta,
      respuestaNormalizada,
      keywords,
      entidades,
      embeddingLiteral,
      resultadoIa: resultado,
    });
    await setExactCacheId(hash, newId);

    return res.json({
      resultado,
      source: 'ia',
    });
  } catch (err) {
    next(err);
  }
}

async function postStoreEvaluation(req, res, next) {
  try {
    const { cursoId, moduloId, preguntaId, respuesta, resultado } = validateStoreBody(req.body);

    const { respuestaNormalizada, keywords, entidades } = preprocessAnswer(respuesta);
    const hash = buildExactCacheKey(cursoId, moduloId, preguntaId, respuestaNormalizada);

    let embedding = await getEmbeddingCache(hash);
    if (embedding) {
      console.log('[store] embedding reutilizado desde Redis');
    } else {
      embedding = generateMockEmbedding(`${hash}:emb`);
      await setEmbeddingCache(hash, embedding);
      console.log('[store] embedding generado (mock) y guardado en Redis');
    }
    const embeddingLiteral = embeddingToPgVectorLiteral(embedding);

    const newId = await answersRepo.insertAnswerRow({
      cursoId,
      moduloId,
      preguntaId,
      respuestaOriginal: respuesta,
      respuestaNormalizada,
      keywords,
      entidades,
      embeddingLiteral,
      resultadoIa: resultado,
    });

    await setExactCacheId(hash, newId);
    console.log('[store] guardado en BD y cache exacto actualizado', { id: newId, hash: hash.slice(0, 12) });

    return res.json({ stored: true, id: newId, source: 'agent' });
  } catch (err) {
    next(err);
  }
}

module.exports = { postEvaluate, postStoreEvaluation, SEMANTIC_THRESHOLD };
