require("dotenv").config();

module.exports = {
    PORT:       process.env.PORT || 3000,
    PROMPT_ID:  process.env.PROMPT_ID,
    PROMPT_VERSION: process.env.PROMPT_VERSION,

    // Correo
    EMAIL_HOST: 'cantinalacastellana.com',
    EMAIL_PORT: 465,
    EMAIL_USER: 'reservaciones@cantinalacastellana.com',
    EMAIL_PASS: process.env.EMAIL_PASSWORD,

    // API externa del menú
    MENU_API_URL: 'https://api.cantinalacastellana.com/menu',

    openai: {
        apiKey: process.env.OPENAI_API_KEY,
    },
};