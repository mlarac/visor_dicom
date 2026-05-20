import * as adminService from '../services/adminService.js';

// ---- LISTADO DE USUARIOS ----
export const getUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
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
    await adminService.createUser({
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
    // Evitar que el admin se borre a sí mismo por error (opcional pero buena práctica)
    if (parseInt(userId) === req.session.user.id) {
       return res.status(400).send('No puedes eliminarte a ti mismo.');
    }
    
    await adminService.deleteUserById(userId);
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
    const targetUser = await adminService.getUserById(userId);
    if (!targetUser) return res.status(404).send('Usuario no encontrado');

    const logs = await adminService.getUserAuditLogs(userId);

    res.render('admin_audit', { targetUser, logs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error obteniendo trazabilidad');
  }
};
