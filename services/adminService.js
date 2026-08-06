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
 * Obtiene los logs de auditoría de un usuario específico de forma paginada.
 * @param {number|string} userId - ID del usuario.
 * @param {number} [page=1] - Número de página.
 * @param {number} [limit=20] - Límite de registros por página.
 * @returns {Promise<{logs: Array<object>, total: number, page: number, totalPages: number, hasMore: boolean}>}
 */
export const getUserAuditLogs = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await AuditLog.findAndCountAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    raw: true
  });

  return {
    logs: rows,
    total: count,
    page: Number(page),
    totalPages: Math.ceil(count / limit),
    hasMore: page * limit < count
  };
};

