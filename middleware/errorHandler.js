// Middleware de manejo de errores centralizado.
// Express lo identifica como error handler porque recibe 4 parámetros (err, req, res, next).
// Se registra al FINAL de todos los middlewares en app.js.
function errorHandler(err, req, res, next) {
    console.error(`[error] ${req.method} ${req.path} →`, err.message);

    // No enviar detalles internos en producción
    const isDev = process.env.NODE_ENV !== 'production';

    res.status(err.status || 500).json({
        error:   err.message || 'Error interno del servidor',
        ...(isDev && { stack: err.stack }),
    });
}

module.exports = errorHandler;