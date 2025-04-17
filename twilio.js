const twilio = require('twilio');

// Configuración de Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;  // En formato 'whatsapp:+14155238886'
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;  // En formato 'whatsapp:+5215539017155'

// Cliente de Twilio
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Envía un mensaje de WhatsApp utilizando Twilio
 * @param {string} to - Número de WhatsApp destino en formato 'whatsapp:+1234567890'
 * @param {string} body - Contenido del mensaje
 * @returns {Promise} - Resultado de la operación
 */
async function sendWhatsAppMessage(to, body) {
    try {
        // Si no se proporciona un número destino, usar el número del administrador
        const targetPhone = to || ADMIN_WHATSAPP_NUMBER;
        
        const message = await twilioClient.messages.create({
            from: TWILIO_WHATSAPP_FROM,
            body: body,
            to: targetPhone
        });

        return {
            success: true,
            messageId: message.sid
        };
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Envía un mensaje de WhatsApp con plantilla utilizando Twilio
 * @param {string} to - Número de WhatsApp destino en formato 'whatsapp:+1234567890'
 * @param {string} templateSid - SID de la plantilla de contenido
 * @param {object} variables - Variables para la plantilla
 * @returns {Promise} - Resultado de la operación
 */
async function sendTemplateMessage(to, templateSid, variables) {
    try {
        const targetPhone = to || ADMIN_WHATSAPP_NUMBER;
        
        const message = await twilioClient.messages.create({
            from: TWILIO_WHATSAPP_FROM,
            contentSid: templateSid,
            contentVariables: JSON.stringify(variables),
            to: targetPhone
        });

        return {
            success: true,
            messageId: message.sid
        };
    } catch (error) {
        console.error('Error sending template WhatsApp message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Notifica sobre una nueva reservación por WhatsApp
 * @param {object} reservation - Datos de la reservación
 * @returns {Promise} - Resultado de la operación
 */
async function notifyReservationWhatsApp({ name, phone, date, guests, formattedDate }) {
    // Opción 1: Mensaje básico de texto
    const message = `
📅 *Nueva Reservación* 📅

*Nombre:* ${name}
*Teléfono:* ${phone}
*Fecha:* ${formattedDate || date}
*Personas:* ${guests}

Reservación registrada exitosamente.
`.trim();

    return await sendWhatsAppMessage(ADMIN_WHATSAPP_NUMBER, message);
    
    // Opción 2: Si prefieres usar una plantilla (descomenta y configura)
    /*
    const RESERVATION_TEMPLATE_SID = process.env.TWILIO_RESERVATION_TEMPLATE_SID;
    
    const variables = {
        "1": name,
        "2": phone,
        "3": formattedDate || date,
        "4": guests.toString()
    };
    
    return await sendTemplateMessage(ADMIN_WHATSAPP_NUMBER, RESERVATION_TEMPLATE_SID, variables);
    */
}

module.exports = {
    sendWhatsAppMessage,
    sendTemplateMessage,
    notifyReservationWhatsApp
};