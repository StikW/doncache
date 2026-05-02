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
  const cursoId = Number(curso_id);
  const moduloId = Number(modulo_id);
  const preguntaId = Number(pregunta_id);
  if (![cursoId, moduloId, preguntaId].every(Number.isFinite)) {
    const err = new Error('curso_id, modulo_id y pregunta_id deben ser números válidos');
    err.statusCode = 400;
    throw err;
  }
  return { cursoId, moduloId, preguntaId, respuesta: respuesta.trim() };
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

module.exports = { postEvaluate, SEMANTIC_THRESHOLD };
