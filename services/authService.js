import { User } from '../models/index.js';
import bcrypt from 'bcrypt';

/**
 * Autentica un usuario verificando su nombre de usuario y contraseña en la base de datos.
 * @param {string} username - Nombre del usuario.
 * @param {string} password - Contraseña ingresada por el usuario.
 * @returns {Promise<object>} Objeto con información básica del usuario autenticado.
 */
export const authenticateUser = async (username, password) => {
  const user = await User.findOne({ where: { username } });
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Contraseña incorrecta');
    error.status = 401;
    throw error;
  }

  return {
    id: user.id,
    role: user.role,
    name: user.username
  };
};
