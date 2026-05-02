function evaluateWithAI(text) {
  return {
    score: Math.random(),
    feedback: 'Mock evaluation',
    correct: Math.random() > 0.5,
    input_preview: typeof text === 'string' ? text.slice(0, 200) : '',
  };
}

module.exports = { evaluateWithAI };
