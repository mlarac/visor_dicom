import { Study, Patient, Series } from '../models/index.js';

/**
 * Obtiene un estudio por su ID.
 * @param {number|string} studyId - ID del estudio.
 * @returns {Promise<object|null>} El estudio encontrado o null.
 */
export const getStudyById = async (studyId) => {
  return await Study.findByPk(studyId);
};

/**
 * Obtiene un estudio por su ID incluyendo la información del paciente y sus series.
 * @param {number|string} studyId - ID del estudio.
 * @returns {Promise<object|null>} El estudio con paciente y series, o null.
 */
export const getStudyWithPatient = async (studyId) => {
  return await Study.findByPk(studyId, {
    include: [Patient, Series]
  });
};

/**
 * Obtiene todas las series de un estudio, ordenadas por número de serie.
 * @param {number|string} studyId - ID del estudio.
 * @returns {Promise<Array>} Lista de series del estudio.
 */
export const getSeriesByStudyId = async (studyId) => {
  return await Series.findAll({
    where: { studyId },
    order: [['seriesNumber', 'ASC']]
  });
};

/**
 * Obtiene una serie por su ID.
 * @param {number|string} seriesId - ID de la serie.
 * @returns {Promise<object|null>} La serie encontrada o null.
 */
export const getSeriesById = async (seriesId) => {
  return await Series.findByPk(seriesId);
};

