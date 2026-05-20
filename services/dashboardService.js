import { AuditLog, Study, Patient } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Obtiene los datos del dashboard: estudios recientes y pacientes según el filtro de búsqueda.
 * @param {number} userId - ID del usuario de la sesión.
 * @param {string} searchQuery - Filtro de búsqueda (RUT o nombres).
 * @param {string} clientIp - Dirección IP del cliente para registrar la búsqueda.
 * @returns {Promise<object>} Objeto con { patients, recentStudies }
 */
export const getDashboardData = async (userId, searchQuery, clientIp) => {
  let patients = [];
  let recentStudies = [];

  // Cargar los últimos 10 estudios abiertos por el usuario
  const recentLogs = await AuditLog.findAll({
    where: {
      userId: userId,
      action: 'Visualización',
      targetStudyId: { [Op.not]: null }
    },
    order: [['createdAt', 'DESC']],
    limit: 100 // Buscar suficientes para obtener 10 únicos
  });

  const uniqueStudyIds = [];
  for (const log of recentLogs) {
    if (!uniqueStudyIds.includes(log.targetStudyId)) {
      uniqueStudyIds.push(log.targetStudyId);
    }
    if (uniqueStudyIds.length === 10) break;
  }

  if (uniqueStudyIds.length > 0) {
    const studies = await Study.findAll({
      where: { id: { [Op.in]: uniqueStudyIds } },
      include: [{ model: Patient }]
    });

    // Mantener el orden reciente
    recentStudies = uniqueStudyIds.map(id => studies.find(s => s.id === id)).filter(Boolean);
  }

  if (searchQuery) {
    const trimmedQuery = searchQuery.trim();
    
    // Requerimiento de auditoría extrema: guardar huella de las búsquedas
    await AuditLog.create({
      userId: userId,
      action: `Búsqueda (Filtro: ${trimmedQuery})`,
      ipAddress: clientIp
    });

    const searchTerms = trimmedQuery.split(/\s+/);
    const nameConditions = searchTerms.map(term => ({
      fullName: { [Op.like]: `%${term}%` }
    }));

    const whereClause = {
      [Op.or]: [
        { [Op.and]: nameConditions },
        { rut: { [Op.like]: `%${trimmedQuery}%` } }
      ]
    };

    // Buscar pacientes con filtro e incluir sus estudios
    patients = await Patient.findAll({
      where: whereClause,
      include: [Study],
      order: [['fullName', 'ASC']],
      limit: 100 // Límite por seguridad
    });
  }

  return { patients, recentStudies };
};
