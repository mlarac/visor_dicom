import * as dashboardService from '../services/dashboardService.js';

/**
 * Renderiza la vista del dashboard con estudios recientes y opcionalmente con pacientes filtrados por búsqueda.
 */
export const getDashboard = async (req, res) => {
  try {
    const searchQuery = req.query.q ? req.query.q.trim() : '';
    const userId = req.session.user.id;
    const clientIp = req.ip;

    const { patients, recentStudies } = await dashboardService.getDashboardData(userId, searchQuery, clientIp);

    res.render('dashboard', { patients, searchQuery, recentStudies });
  } catch (err) {
    console.error('Error cargando dashboard', err);
    res.status(500).send('Error del servidor');
  }
};
