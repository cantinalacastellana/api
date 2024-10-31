const { get } = require('https');
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

// Función para obtener la fecha actual en México
function getCurrentMexicoDate() {
    return new Date(new Date().toLocaleString('en-US', {
        timeZone: 'America/Mexico_City'
    }));
}

// Función para enviar la reservación
async function sendReservation({ name, phone, date, guests }) {
    try {
        // Ajustar la fecha recibida a la zona horaria de México
        const reservationDate = new Date(date);
        const mexicoTimeZoneOffset = getCurrentMexicoDate().getTimezoneOffset() * 60000; // Offset en milisegundos
        const adjustedDate = new Date(reservationDate.getTime() + mexicoTimeZoneOffset);

        // Formatear la fecha para mejor legibilidad (solo fecha, sin hora)
        const formattedDate = adjustedDate.toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Mexico_City'
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
            messageId: info.messageId,
            formattedDate: formattedDate // Incluimos la fecha formateada en la respuesta
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
    const todayInMexico = getCurrentMexicoDate();
    
    // Validar nombre
    if (!reservationData.name || reservationData.name.trim().length < 2) {
        errors.push('El nombre es requerido y debe tener al menos 2 caracteres');
    }

    // Validar teléfono
    if (!reservationData.phone || !/^\+?[\d\s-]{8,}$/.test(reservationData.phone)) {
        errors.push('El número de teléfono es inválido');
    }

    // Validar fecha
    if (!reservationData.date) {
        errors.push('La fecha es requerida');
    } else {
        try {
            const reservationDate = new Date(reservationData.date);
            reservationDate.setHours(0, 0, 0, 0);

            // Ajustar la fecha a la zona horaria de México
            const mexicoTimeZoneOffset = todayInMexico.getTimezoneOffset() * 60000;
            const adjustedReservationDate = new Date(reservationDate.getTime() + mexicoTimeZoneOffset);
            adjustedReservationDate.setHours(0, 0, 0, 0); // Asegúrate de que esté en el inicio del día

            if (isNaN(adjustedReservationDate.getTime())) {
                errors.push('El formato de la fecha es inválido');
            } else {
                // Validar que la fecha no sea en el pasado o hoy
                if (adjustedReservationDate <= todayInMexico) {
                    errors.push('La reservación debe ser para una fecha futura (a partir de mañana)');
                }

                // Validar que la fecha no sea más de 3 meses en el futuro
                const maxDate = new Date(todayInMexico);
                maxDate.setMonth(maxDate.getMonth() + 3);
                if (adjustedReservationDate > maxDate) {
                    errors.push('Las reservaciones solo se pueden hacer con hasta 3 meses de anticipación');
                }
            }
        } catch (error) {
            errors.push('La fecha proporcionada no es válida');
        }
    }

    // Validar número de personas
    if (!reservationData.guests || reservationData.guests < 1 || reservationData.guests > 20) {
        errors.push('El número de personas debe estar entre 1 y 20');
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        currentDate: todayInMexico.toISOString().split('T')[0] // Incluimos la fecha actual de México
    };
}

module.exports = {
    sendReservation,
    validateReservation,
    getCurrentMexicoDate
};
