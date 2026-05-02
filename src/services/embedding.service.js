const crypto = require('crypto');

const DIM = 1536;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s) {
  const h = crypto.createHash('sha256').update(s, 'utf8').digest();
  return h.readUInt32BE(0);
}

/**
 * Embedding determinista (mock) estable para la misma entrada; sustituir por API real.
 */
function generateMockEmbedding(seedString) {
  const rand = mulberry32(seedFromString(seedString));
  const v = new Array(DIM);
  let sumSq = 0;
  for (let i = 0; i < DIM; i += 1) {
    const x = rand() * 2 - 1;
    v[i] = x;
    sumSq += x * x;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return v.map((x) => x / norm);
}

function embeddingToPgVectorLiteral(vec) {
  return `[${vec.join(',')}]`;
}

module.exports = {
  DIM,
  generateMockEmbedding,
  embeddingToPgVectorLiteral,
};
