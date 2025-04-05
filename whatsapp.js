const axios = require('axios');

// Configuración de WhatsApp Business API
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const ADMIN_PHONE_NUMBER = process.env.ADMIN_PHONE_NUMBER; // Tu número en formato internacional sin +

// Función para enviar mensajes de WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        // Si no se proporciona un número específico, usar el número del administrador
        const targetPhone = phoneNumber || ADMIN_PHONE_NUMBER;
        
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: targetPhone,
                type: 'text',
                text: {
                    body: message
                }
            }
        });

        return {
            success: true,
            messageId: response.data.messages[0].id
        };
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}

// Función para notificar sobre una nueva reservación por WhatsApp
async function notifyReservationWhatsApp({ name, phone, date, guests, formattedDate }) {
    const message = `
📅 *Nueva Reservación* 📅

*Nombre:* ${name}
*Teléfono:* ${phone}
*Fecha:* ${formattedDate || date}
*Personas:* ${guests}

Reservación registrada exitosamente.
`.trim();

    return await sendWhatsAppMessage(ADMIN_PHONE_NUMBER, message);
}

module.exports = {
    sendWhatsAppMessage,
    notifyReservationWhatsApp
};