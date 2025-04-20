const twilio = require('twilio');

// Configuración de Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;  // En formato 'whatsapp:+14155238886'
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;  // En formato 'whatsapp:+5215539017155'
// Template SID para las reservaciones - debe estar configurado en la consola de Twilio
const RESERVATION_TEMPLATE_SID = process.env.TWILIO_RESERVATION_TEMPLATE_SID;

// Cliente de Twilio
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

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
 * Notifica sobre una nueva reservación por WhatsApp usando una plantilla
 * @param {object} reservation - Datos de la reservación
 * @returns {Promise} - Resultado de la operación
 */
async function notifyReservationWhatsApp({ name, phone, date, guests, formattedDate }) {
    // Después del 1 de abril de 2025, solo se pueden usar plantillas para mensajes iniciados por el negocio
    if (!RESERVATION_TEMPLATE_SID) {
        console.error('TWILIO_RESERVATION_TEMPLATE_SID not configured');
        return {
            success: false,
            error: 'Template SID not configured'
        };
    }
    
    // Variables para la plantilla - ajusta según la estructura de tu plantilla aprobada
    const variables = {
        "1": name,
        "2": phone,
        "3": formattedDate || date,
        "4": guests.toString()
    };
    
    return await sendTemplateMessage(ADMIN_WHATSAPP_NUMBER, RESERVATION_TEMPLATE_SID, variables);
}

// Ya no exportamos sendWhatsAppMessage porque no se puede usar para mensajes iniciados por el negocio
module.exports = {
    sendTemplateMessage,
    notifyReservationWhatsApp
};