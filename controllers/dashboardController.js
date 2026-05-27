import * as dashboardService from '../services/dashboardService.js';

/**
 * Formatea una fecha a DD/MM/AAAA de manera segura para zonas horarias.
 */
const formatDate = (dateVal) => {
  if (!dateVal) return '-';
  if (dateVal instanceof Date) {
    const day = String(dateVal.getUTCDate()).padStart(2, '0');
    const month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const year = dateVal.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof dateVal === 'string') {
    if (dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateVal;
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  return String(dateVal);
};

/**
 * Renderiza la vista del dashboard con estudios recientes y opcionalmente con pacientes filtrados por búsqueda.
 */
export const getDashboard = async (req, res) => {
  try {
    const searchQuery = req.query.q ? req.query.q.trim() : '';
    const userId = req.session.user.id;
    const clientIp = req.ip;

    const { patients, recentStudies } = await dashboardService.getDashboardData(userId, searchQuery, clientIp);

    // Convertir a objetos planos y formatear la fecha para no ensuciar la vista
    const formattedRecentStudies = recentStudies.map(study => {
      const plain = study.get({ plain: true });
      plain.date = formatDate(plain.date);
      return plain;
    });

    const formattedPatients = patients.map(patient => {
      const plain = patient.get({ plain: true });
      if (plain.Studies) {
        plain.Studies = plain.Studies.map(study => {
          study.date = formatDate(study.date);
          return study;
        });
      }
      return plain;
    });

    res.render('dashboard', {
      patients: formattedPatients,
      searchQuery,
      recentStudies: formattedRecentStudies
    });
  } catch (err) {
    console.error('Error cargando dashboard', err);
    res.status(500).send('Error del servidor');
  }
};
