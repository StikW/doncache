-- Ejecutar en Supabase SQL Editor o psql (requiere extensión pgvector habilitada en el proyecto)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS answers_cache (
  id SERIAL PRIMARY KEY,
  curso_id TEXT NOT NULL,
  modulo_id TEXT NOT NULL,
  pregunta_id TEXT NOT NULL,
  respuesta_original TEXT NOT NULL,
  respuesta_normalizada TEXT NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  entidades JSONB DEFAULT '[]'::jsonb,
  embedding vector(1536) NOT NULL,
  resultado_ia JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice IVFFLAT para búsqueda por similitud coseno (ajusta lists según volumen)
CREATE INDEX IF NOT EXISTS answers_cache_embedding_ivfflat
  ON answers_cache
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
