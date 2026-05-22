import { User, AuditLog } from '../models/index.js';

/**
 * Obtiene todos los usuarios ordenados por ID sin incluir la contraseña.
 * @returns {Promise<Array<object>>} Lista de usuarios.
 */
export const getAllUsers = async () => {
  return await User.findAll({
    attributes: { exclude: ['password'] },
    order: [['id', 'ASC']]
  });
};

/**
 * Crea un nuevo usuario en la base de datos.
 * @param {object} userData - Datos del usuario.
 * @param {string} userData.username - Nombre de usuario.
 * @param {string} userData.password - Contraseña (será hasheada automáticamente por el hook del modelo User).
 * @param {string} userData.role - Rol del usuario.
 * @returns {Promise<object>} El usuario creado.
 */
export const createUser = async ({ username, password, role }) => {
  return await User.create({
    username,
    password,
    role: role || 'Usuario'
  });
};

/**
 * Elimina un usuario por su ID.
 * @param {number|string} userId - ID del usuario a eliminar.
 * @returns {Promise<number>} Número de registros eliminados.
 */
export const deleteUserById = async (userId) => {
  return await User.destroy({ where: { id: userId } });
};

/**
 * Obtiene información básica de un usuario por su ID.
 * @param {number|string} userId - ID del usuario.
 * @returns {Promise<object|null>} Usuario encontrado o null.
 */
export const getUserById = async (userId) => {
  return await User.findByPk(userId, { attributes: ['id', 'username', 'role'] });
};

/**
 * Obtiene todos los logs de auditoría de un usuario específico.
 * @param {number|string} userId - ID del usuario.
 * @returns {Promise<Array<object>>} Lista de logs de auditoría.
 */
export const getUserAuditLogs = async (userId) => {
  return await AuditLog.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });
};
