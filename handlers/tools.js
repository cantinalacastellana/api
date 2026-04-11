const { fetchMenu }        = require('../services/menu');
const { sendReservation }  = require('../services/email');

// Ejecuta todas las tool calls que devolvió el modelo
// y retorna los resultados en el formato que espera la Responses API.
async function processToolCalls(toolCalls) {
    const toolOutputs = [];

    for (const toolCall of toolCalls) {
        const fnName = toolCall.name;
        const fnArgs = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
        let output;

        switch (fnName) {

            case 'fetch_menu':
                output = await fetchMenu();
                break;

            case 'get_current_date': {
                const now = new Date();
                const currentDate = now.toLocaleString('es-MX', {
                    timeZone: 'America/Mexico_City',
                    weekday: 'long', year: 'numeric',
                    month: 'long',   day: 'numeric',
                });
                const isoDate = new Date(now.toLocaleString('en-US', {
                    timeZone: 'America/Mexico_City',
                })).toISOString().split('T')[0];

                output = {
                    currentDate,
                    isoDate,
                    message: `La fecha actual en Ciudad de México es ${currentDate}.`,
                };
                break;
            }

            case 'make_reservation': {
                const { name, phone, date, time, guests } = fnArgs;

                if (!name || !phone || !date || !time || !guests) {
                    output = {
                        success: false,
                        error: 'Faltan datos. Solicita al cliente: nombre, teléfono, fecha, hora y número de personas.',
                    };
                    break;
                }

                output = await sendReservation(fnArgs);
                break;
            }

            default:
                output = { error: `Función no reconocida: ${fnName}` };
        }

        // Formato de tool output para la Responses API
        toolOutputs.push({
            type:   "function_call_output",
            call_id: toolCall.call_id,
            output:  JSON.stringify(output),
        });
    }

    return toolOutputs;
}

module.exports = { processToolCalls };