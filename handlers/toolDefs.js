const toolDefs = [
    {
        type: "function",
        name: "fetch_menu",
        description: "Obtiene el menú desde la API de la cantina y lo envía como contexto al asistente",
        parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "get_current_date",
        description: "Devuelve la fecha actual en Ciudad de México",
        parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "make_reservation",
        description: "Realiza una reservación en el restaurante. Llamar get_current_date primero para validar la fecha",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Nombre completo del cliente"
                },
                phone: {
                    type: "string",
                    description: "Teléfono de contacto de 10 dígitos"
                },
                date: {
                    type: "string",
                    // ANTES: decía "formato YYYY-MM-DD" → el modelo se lo pedía al usuario así
                    // AHORA: el modelo convierte internamente, el usuario escribe como quiera
                    description: "Fecha de la reservación en formato YYYY-MM-DD. El modelo debe convertir lo que diga el usuario (ej: 'el viernes', 'mañana', '15 de mayo') a este formato internamente, sin pedírselo al cliente."
                },
                time: {
                    type: "string",
                    description: "Hora de la reservación en formato HH:MM de 24 horas. Convertir internamente si el usuario dice '2 de la tarde' → '14:00'."
                },
                guests: {
                    type: "integer",
                    description: "Número de comensales (entero mayor a 0)"
                }
            },
            required: ["name", "phone", "date", "time", "guests"],
            additionalProperties: false,
        },
        strict: true,
    }
];

module.exports = toolDefs;