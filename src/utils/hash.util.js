const crypto = require('crypto');

/**
 * hash = sha256(String(curso_id) + String(modulo_id) + String(pregunta_id) + respuesta_normalizada)
 */
function buildExactCacheKey(cursoId, moduloId, preguntaId, respuestaNormalizada) {
  const payload = String(cursoId) + String(moduloId) + String(preguntaId) + respuestaNormalizada;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

module.exports = { buildExactCacheKey };
