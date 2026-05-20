import { Study, Patient } from '../models/index.js';

/**
 * Obtiene un estudio por su ID.
 * @param {number|string} studyId - ID del estudio.
 * @returns {Promise<object|null>} El estudio encontrado o null.
 */
export const getStudyById = async (studyId) => {
  return await Study.findByPk(studyId);
};

/**
 * Obtiene un estudio por su ID incluyendo la información del paciente relacionado.
 * @param {number|string} studyId - ID del estudio.
 * @returns {Promise<object|null>} El estudio con paciente o null.
 */
export const getStudyWithPatient = async (studyId) => {
  return await Study.findByPk(studyId, {
    include: [Patient]
  });
};
