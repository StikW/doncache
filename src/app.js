require('dotenv').config();

const express = require('express');
const { postEvaluate } = require('./controllers/evaluateController');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/evaluate', postEvaluate);

app.use((err, _req, res, _next) => {
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = status === 500 ? 'Error interno del servidor' : err.message;
  if (status === 500) {
    console.error('[error]', err);
  }
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`DonCache evaluate API escuchando en puerto ${port}`);
});

module.exports = app;
