const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const conn = process.env.SUPABASE_DB_URL;
    if (!conn) {
      throw new Error('SUPABASE_DB_URL no está definido');
    }
    pool = new Pool({ connectionString: conn, max: 10 });
  }
  return pool;
}

/**
 * Distancia coseno `<=>` alineada con índice vector_cosine_ops (pgvector).
 * Umbral bajo = más similitud.
 */
async function semanticSearchNearest(cursoId, moduloId, preguntaId, embeddingLiteral, limit = 3) {
  const p = getPool();
  const sql = `
    SELECT id, resultado_ia,
           (embedding <=> $1::vector) AS distance
    FROM answers_cache
    WHERE curso_id = $2
      AND modulo_id = $3
      AND pregunta_id = $4
    ORDER BY embedding <=> $1::vector
    LIMIT $5
  `;
  const { rows } = await p.query(sql, [embeddingLiteral, cursoId, moduloId, preguntaId, limit]);
  return rows;
}

async function findById(id) {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, resultado_ia, respuesta_original, respuesta_normalizada, created_at
     FROM answers_cache WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function insertAnswerRow({
  cursoId,
  moduloId,
  preguntaId,
  respuestaOriginal,
  respuestaNormalizada,
  keywords,
  entidades,
  embeddingLiteral,
  resultadoIa,
}) {
  const p = getPool();
  const sql = `
    INSERT INTO answers_cache (
      curso_id, modulo_id, pregunta_id,
      respuesta_original, respuesta_normalizada,
      keywords, entidades,
      embedding, resultado_ia
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::vector, $9::jsonb)
    RETURNING id
  `;
  const { rows } = await p.query(sql, [
    cursoId,
    moduloId,
    preguntaId,
    respuestaOriginal,
    respuestaNormalizada,
    JSON.stringify(keywords ?? []),
    JSON.stringify(entidades ?? []),
    embeddingLiteral,
    JSON.stringify(resultadoIa),
  ]);
  return rows[0].id;
}

module.exports = {
  getPool,
  semanticSearchNearest,
  findById,
  insertAnswerRow,
};
