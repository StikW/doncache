/**
 * Normalización ligera: minúsculas, sin puntuación reiterada, trim.
 * Keywords: tokens alfanuméricos filtrados por longitud mínima.
 */
const STOPWORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'y', 'a', 'que', 'es', 'por', 'con', 'se', 'no',
]);

function normalizeAnswer(text) {
  if (typeof text !== 'string') return '';
  let s = text.toLowerCase();
  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function extractKeywords(normalized) {
  if (!normalized) return [];
  const tokens = normalized.split(' ').filter((w) => w.length >= 3);
  return [...new Set(tokens.filter((t) => !STOPWORDS_ES.has(t)))].slice(0, 20);
}

function extractEntities(_normalized) {
  // MVP: sin NER; lista vacía o futura ampliación
  return [];
}

function preprocessAnswer(respuesta) {
  const respuestaNormalizada = normalizeAnswer(respuesta);
  const keywords = extractKeywords(respuestaNormalizada);
  const entidades = extractEntities(respuestaNormalizada);
  return { respuestaNormalizada, keywords, entidades };
}

module.exports = {
  normalizeAnswer,
  extractKeywords,
  extractEntities,
  preprocessAnswer,
};
