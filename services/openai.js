const OpenAI   = require('openai');
const { openai: cfg } = require('../config');

// Cliente único compartido en toda la app
const openai = new OpenAI({ apiKey: cfg.apiKey });

module.exports = openai;