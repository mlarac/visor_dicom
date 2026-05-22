// middleware para validar si está autenticado
export const isAuthenticated = (req, res, next) => {
  if (req.session?.user) {
    return next();
  }
  res.redirect('/login');
};

// middleware para validar si además es Admin
export const isAdmin = (req, res, next) => {
  if (req.session?.user?.role === 'Admin') {
    return next();
  }
  res.status(403).send('Acceso denegado: Se requieren permisos de Administrador.');
};
