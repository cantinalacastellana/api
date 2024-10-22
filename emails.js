const nodemailer = require('nodemailer');

// Configuración del transporter de correo
const transporter = nodemailer.createTransport({
    host: 'cantinalacastellana.com',
    port: 465,
    secure: true,
    auth: {
        user: 'reservaciones@cantinalacastellana.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Función para enviar la reservación
async function sendReservation({name, phone, date, guests}) {
    try {
        // Formatear la fecha para mejor legibilidad (solo fecha, sin hora)
        const formattedDate = new Date(date).toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Crear el contenido del correo
        const emailContent = `
            Nueva Reservación:
            
            Nombre: ${name}
            Teléfono: ${phone}
            Fecha: ${formattedDate}
            Número de personas: ${guests}
        `.trim();

        // Enviar el correo
        const info = await transporter.sendMail({
            from: 'reservaciones@cantinalacastellana.com',
            to: 'reservaciones@cantinalacastellana.com',
            subject: `Nueva Reservación - ${name}`,
            text: emailContent
        });

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('Error sending reservation email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Función para validar los datos de la reservación
function validateReservation(reservationData) {
    const errors = [];

    if (!reservationData.name || reservationData.name.trim().length < 2) {
        errors.push('El nombre es requerido y debe tener al menos 2 caracteres');
    }

    if (!reservationData.phone || !/^\+?[\d\s-]{8,}$/.test(reservationData.phone)) {
        errors.push('El número de teléfono es inválido');
    }

    // Validación de fecha (solo fecha, sin hora)
    if (!reservationData.date) {
        errors.push('La fecha es requerida');
    } else {
        const reservationDate = new Date(reservationData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(reservationDate.getTime())) {
            errors.push('El formato de la fecha es inválido');
        } else {
            reservationDate.setHours(0, 0, 0, 0);
            if (reservationDate < today) {
                errors.push('La fecha de reservación no puede ser en el pasado');
            }
        }
    }

    if (!reservationData.guests || reservationData.guests < 1 || reservationData.guests > 20) {
        errors.push('El número de personas debe estar entre 1 y 20');
    }

    return errors;
}

module.exports = {
    sendReservation,
    validateReservation
};