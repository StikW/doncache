# DonCache — Evaluación híbrida (Redis + pgvector)

API MVP en Node.js que evalúa respuestas de usuario con:

1. Normalización NLP ligera
2. Caché exacta en Redis (`sha256` del scope + texto normalizado)
3. Búsqueda semántica en PostgreSQL (pgvector, distancia coseno)
4. Fallback a evaluación mock (sustituible por llamada HTTP con `axios`)

## Requisitos

- Node.js 18+
- PostgreSQL con extensión [pgvector](https://github.com/pgvector/pgvector) (p. ej. Supabase)
- Redis

## Configuración

1. Copia variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Ajusta `SUPABASE_DB_URL` y `REDIS_URL` en `.env`.

3. Ejecuta el SQL del esquema en tu base (Supabase → SQL Editor o `psql`):

   Ver `schema.sql`.

4. Instala e inicia:

   ```bash
   npm install
   npm start
   ```

   En local, por defecto el puerto es `3000` o el valor de `PORT` (Render inyecta `PORT`).

## Endpoint principal

`POST /evaluate`

Cuerpo JSON:

```json
{
  "curso_id": 1,
  "modulo_id": 2,
  "pregunta_id": 5,
  "respuesta": "La fotosíntesis ocurre en las hojas"
}
```

Respuesta:

```json
{
  "resultado": { "score": 0.42, "feedback": "Mock evaluation", "correct": true },
  "source": "cache_exact | cache_semantic | ia"
}
```

- `cache_exact`: hit en Redis + fila en `answers_cache`
- `cache_semantic`: vecino con distancia coseno `<` umbral (0.25); se rellena caché exacta
- `ia`: mock; inserta fila y actualiza Redis

## Notas técnicas

- La consulta usa el operador de distancia coseno de pgvector (`<=>`), coherente con el índice `vector_cosine_ops` del `schema.sql`. La guía original mencionaba `<->` (L2); con índice coseno conviene `<=>`.
- Los embeddings son **mock deterministas** (vector 1536 normalizado) hasta conectar un proveedor real.
- `GET /health` para comprobaciones de despliegue.

## Despliegue en Render

- Comando de build: `npm install`
- Comando de arranque: `npm start`
- Variables: `SUPABASE_DB_URL`, `REDIS_URL`, `PORT` (gestionada por Render)
# doncache
