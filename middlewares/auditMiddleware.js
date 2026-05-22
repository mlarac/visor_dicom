import { AuditLog } from '../models/index.js';

/**
 * Middleware para registrar la auditoría extrema de acciones.
 * @param {string} action - Acción realizada (e.g. 'Búsqueda', 'Visualización', 'Descarga')
 * @returns {function} middleware de express
 */
const auditMiddleware = (action) => {
  return async (req, res, next) => {
    try {
      // Intentamos extraer IDs relevantes de manera segura con optional chaining.
      const targetPatientId = req.params?.patientId || req.query?.patientId || req.body?.patientId || null;
      const targetStudyId = req.params?.studyId || req.query?.studyId || req.body?.studyId || null;
      
      const userId = req.session?.user ? req.session.user.id : null;

      // Creamos el registro en la base de datos antes de continuar
      await AuditLog.create({
        userId: userId,
        action: action,
        targetPatientId: targetPatientId,
        targetStudyId: targetStudyId,
        ipAddress: req.ip
      });

      next();
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
      // Dependiendo de las reglas de negocio, podemos querer que la ruta falle 
      // si la auditoría falla. En este caso lo pasamos al error handler.
      next(error); 
    }
  };
};

export default auditMiddleware;
