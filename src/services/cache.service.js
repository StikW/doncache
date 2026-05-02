const Redis = require('ioredis');

let redisClient;

function getRedis() {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL no está definido');
    }
    redisClient = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return redisClient;
}

async function getExactCacheId(hash) {
  const r = getRedis();
  const key = `cache:${hash}`;
  const id = await r.get(key);
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

async function setExactCacheId(hash, answerId) {
  const r = getRedis();
  const key = `cache:${hash}`;
  await r.set(key, String(answerId));
}

async function getEmbeddingCache(hash) {
  const r = getRedis();
  const key = `embedding:${hash}`;
  const raw = await r.get(key);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

async function setEmbeddingCache(hash, vector) {
  const r = getRedis();
  const key = `embedding:${hash}`;
  await r.set(key, JSON.stringify(vector));
}

module.exports = {
  getRedis,
  getExactCacheId,
  setExactCacheId,
  getEmbeddingCache,
  setEmbeddingCache,
};
