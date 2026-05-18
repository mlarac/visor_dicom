import { User, AuditLog } from '../models/index.js';

// ---- LISTADO DE USUARIOS ----
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });
    res.render('admin_users', { users });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error interno servidor');
  }
};

// ---- FORMULARIO CREAR USUARIO ----
export const getCreateUserForm = (req, res) => {
  res.render('admin_create_user');
};

// ---- PROCESAR CREAR USUARIO ----
export const createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    await User.create({
      username,
      password,
      role: role || 'Usuario'
    });
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    // Para simplificar, devolvemos a la vista con error
    res.render('admin_create_user', { error: 'Ocurrió un error (¿Quizás el nombre de usuario ya existe?)' });
  }
};

// ---- ELIMINAR USUARIO ----
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    // Evitar que el admin se borre a si mismo por error (opcional pero buena prácita)
    if (parseInt(userId) === req.session.user.id) {
       return res.status(400).send('No puedes eliminarte a ti mismo.');
    }
    
    await User.destroy({ where: { id: userId } });
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error borrando usuario');
  }
};

// ---- VER AUDITORÍA DE USUARIO ----
export const getUserAudit = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validar usuario
    const targetUser = await User.findByPk(userId, { attributes: ['id', 'username', 'role'] });
    if (!targetUser) return res.status(404).send('Usuario no encontrado');

    const logs = await AuditLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    res.render('admin_audit', { targetUser, logs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error obteniendo trazabilidad');
  }
};
