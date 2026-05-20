import * as authService from '../services/authService.js';

/**
 * Redirige al dashboard si hay sesión activa, o a la vista de login en caso contrario.
 */
export const redirectHome = (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
};

/**
 * Renderiza la vista de login. Si ya tiene sesión activa, redirige al dashboard.
 */
export const renderLogin = (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login');
};

/**
 * Procesa la autenticación del usuario.
 */
export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const userSessionData = await authService.authenticateUser(username, password);

    // Login exitoso, guardamos en sesión
    req.session.user = userSessionData;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error de autenticación:', error);
    
    // Si es un error esperado de credenciales erróneas o usuario no encontrado
    if (error.status === 404 || error.status === 401) {
      return res.render('login', { error: error.message });
    }
    
    res.status(500).send('Error en el servidor durante el login');
  }
};

/**
 * Destruye la sesión actual y redirige a la vista de login.
 */
export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destruyendo la sesión:', err);
      return res.status(500).send('Error al cerrar sesión');
    }
    res.redirect('/login');
  });
};
