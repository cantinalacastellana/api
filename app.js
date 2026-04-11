const express        = require('express');
const cors           = require('cors');
const errorHandler   = require('./middleware/errorHandler');
const chatRoute      = require('./routes/chat');
const convRoute      = require('./routes/conversation');

const app = express();

// Middlewares globales
app.use(express.json());
app.use(cors());

// Rutas
app.use('/thread',  convRoute);   // GET  /thread      → crear conversación
app.use('/message', chatRoute);   // POST /message     → enviar mensaje

// Manejo de errores (siempre al final)
app.use(errorHandler);

module.exports = app;