import { AuditLog } from '../models/index.js';

/**
 * Middleware para registrar la auditoría asíncrona no bloqueante de acciones.
 * No bloquea la respuesta HTTP del usuario y registra el evento en segundo plano.
 * @param {string} action - Acción realizada (e.g. 'Búsqueda', 'Visualización', 'Descarga')
 * @returns {function} middleware de express
 */
const auditMiddleware = (action) => {
  return (req, res, next) => {
    // 1. Intentar extraer IDs relevantes de la petición
    const targetPatientId = req.params?.patientId || req.query?.patientId || req.body?.patientId || null;
    const targetStudyId = req.params?.studyId || req.query?.studyId || req.body?.studyId || null;
    const userId = req.session?.user ? req.session.user.id : null;
    const ipAddress = req.ip || req.socket?.remoteAddress || null;

    // 2. Dar paso inmediato a la siguiente función/controlador (cero latencia para el usuario)
    next();

    // 3. Registrar auditoría en segundo plano tras finalizar la respuesta exitosa
    res.on('finish', () => {
      if (res.statusCode < 400) {
        AuditLog.create({
          userId: userId,
          action: action,
          targetPatientId: targetPatientId,
          targetStudyId: targetStudyId,
          ipAddress: ipAddress
        }).catch((err) => {
          console.error('Error en auditoría asíncrona en segundo plano:', err);
        });
      }
    });
  };
};

export default auditMiddleware;
