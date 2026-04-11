const axios          = require('axios');
const { MENU_API_URL } = require('../config');

async function fetchMenu() {
    try {
        const response = await axios.get(MENU_API_URL);
        return response.data;
    } catch (error) {
        console.error('[menu] Error al obtener el menú:', error.message);
        return null;
    }
}

module.exports = { fetchMenu };