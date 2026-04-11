const express  = require('express');
const openai   = require('../services/openai');

const router = express.Router();

// Crea una nueva conversación (equivalente al antiguo Thread de Assistants API).
// El frontend guarda el ID y lo manda en cada mensaje posterior.
router.get('/', async (req, res, next) => {
    try {
        const conversation = await openai.conversations.create();
        // Devolvemos "threadId" para no tener que cambiar nada en Chat.tsx
        res.json({ threadId: conversation.id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;