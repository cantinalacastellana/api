const express              = require('express');
const openai               = require('../services/openai');
const toolDefs             = require('../handlers/toolDefs');
const { processToolCalls } = require('../handlers/tools');
const { PROMPT_ID, PROMPT_VERSION } = require('../config');

const router = express.Router();

// Tipos de output que SÍ pueden viajar de vuelta como input en el siguiente turno.
// Los items de tipo "reasoning" no se pueden reenviar cuando store: false,
// porque no están persistidos en el servidor de OpenAI.
const REUSABLE_OUTPUT_TYPES = new Set(['message', 'function_call', 'function_call_output']);

router.post('/', async (req, res, next) => {
    const { message, history = [] } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Se requiere el campo message' });
    }

    try {
        const inputItems = [
            ...history,
            { role: 'user', content: message },
        ];

        let finalText = '';

        while (true) {
            const response = await openai.responses.create({
                prompt: { id: PROMPT_ID, version: PROMPT_VERSION },
                input:  inputItems,
                store:  false,
                tools:  toolDefs,
            });

            const toolCalls = response.output.filter(item => item.type === 'function_call');

            if (toolCalls.length > 0) {
                const toolOutputs = await processToolCalls(toolCalls);

                // Solo reenviar los output items que la API acepta como input.
                // Filtrar "reasoning" y cualquier otro tipo no permitido con store: false.
                const reusableOutput = response.output.filter(
                    item => REUSABLE_OUTPUT_TYPES.has(item.type)
                );

                inputItems.push(...reusableOutput, ...toolOutputs);
            } else {
                const messageOutput = response.output.find(item => item.type === 'message');
                const textContent   = messageOutput?.content?.find(c => c.type === 'output_text');
                finalText           = textContent?.text ?? '';
                break;
            }
        }

        res.json({
            status:   'completed',
            messages: [[{ text: { value: finalText } }]],
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;