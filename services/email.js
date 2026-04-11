const nodemailer = require('nodemailer');
const {
    EMAIL_HOST, EMAIL_PORT,
    EMAIL_USER, EMAIL_PASS,
} = require('../config');

const transporter = nodemailer.createTransport({
    host:   EMAIL_HOST,
    port:   EMAIL_PORT,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

function getCurrentMexicoDate() {
    return new Date(new Date().toLocaleString('en-US', {
        timeZone: 'America/Mexico_City',
    }));
}

async function sendReservation({ name, phone, date, time, guests }) {
    try {
        const reservationDate = new Date(date + 'T00:00:00-06:00');
        const formattedDate = reservationDate.toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric',
            month: 'long',   day: 'numeric',
            timeZone: 'America/Mexico_City',
        });

        const cleanPhone    = phone.replace(/\D/g, '');
        const waMessage     = `¡Hola ${name}! Te confirmamos tu reservación en Cantina La Castellana para el ${formattedDate} a las ${time} para ${guests} personas. ¡Te esperamos!`;
        const waLink        = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Nueva Reservación Recibida</h2>
                <p><strong>Nombre:</strong> ${name}</p>
                <p><strong>Teléfono:</strong> ${phone}</p>
                <p><strong>Fecha:</strong> ${formattedDate}</p>
                <p><strong>Hora:</strong> ${time}</p>
                <p><strong>Número de personas:</strong> ${guests}</p>
                <br/>
                <a href="${waLink}" style="display:inline-block;padding:12px 20px;background-color:#25D366;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
                    Confirmar por WhatsApp al Cliente
                </a>
            </div>`;

        const info = await transporter.sendMail({
            from:    EMAIL_USER,
            to:      EMAIL_USER,
            subject: `Nueva Reservación - ${name}`,
            html:    htmlContent,
        });

        return { success: true, messageId: info.messageId, formattedDate };
    } catch (error) {
        console.error('[email] Error al enviar reservación:', error.message);
        return { success: false, error: error.message };
    }
}

function validateReservation(data) {
    const errors = [];
    const today  = getCurrentMexicoDate();

    if (!data.name || data.name.trim().length < 2)
        errors.push('El nombre es requerido y debe tener al menos 2 caracteres');

    if (!data.phone || !/^\+?[\d\s-]{8,}$/.test(data.phone))
        errors.push('El número de teléfono es inválido');

    if (!data.time)
        errors.push('La hora de reservación es requerida');

    if (!data.date) {
        errors.push('La fecha es requerida');
    } else {
        try {
            const resDate = new Date(data.date + 'T00:00:00-06:00');
            resDate.setHours(0, 0, 0, 0);

            if (isNaN(resDate.getTime())) {
                errors.push('El formato de la fecha es inválido');
            } else {
                if (resDate <= today)
                    errors.push('La reservación debe ser para una fecha futura (a partir de mañana)');

                const maxDate = new Date(today);
                maxDate.setMonth(maxDate.getMonth() + 3);
                if (resDate > maxDate)
                    errors.push('Las reservaciones solo se pueden hacer con hasta 3 meses de anticipación');
            }
        } catch {
            errors.push('La fecha proporcionada no es válida');
        }
    }

    if (!data.guests || data.guests < 1 || data.guests > 20)
        errors.push('El número de personas debe estar entre 1 y 20');

    return {
        isValid:     errors.length === 0,
        errors,
        currentDate: today.toISOString().split('T')[0],
    };
}

module.exports = { sendReservation, validateReservation, getCurrentMexicoDate };