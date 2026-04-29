import express from 'express';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const SequelizeStore = ConnectSessionSequelize(session.Store);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { sequelize, Patient, Study, AuditLog, User } from './models/index.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import { downloadDicom, viewDicom } from './controllers/dicomController.js';
import auditMiddleware from './middlewares/auditMiddleware.js';
import { isAuthenticated, isAdmin } from './middlewares/authMiddleware.js';
import * as adminController from './controllers/adminController.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));

// Configuración de la Sesión con connect-session-sequelize
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'Sessions', // Por defecto crearía 'Sessions'
  checkExpirationInterval: 15 * 60 * 1000, // Limpiar sesiones expiradas cada 15 min
  expiration: 24 * 60 * 60 * 1000 // Sesión válida por 24 horas
});

app.use(session({
  secret: 'my-super-secret-key-dicom', // En producción, usar variable de entorno
  store: sessionStore,
  resave: false, // No guardar si no hubo cambios
  saveUninitialized: false, // No guardar sesiones vacías
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true si usa HTTPS
    httpOnly: true, // Protege contra XSS
    sameSite: 'lax', // Protege contra CSRF (CSRF Mitigation)
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Sincronizar store (crea la tabla Sessions en MySQL)
sessionStore.sync();

// Pasar la sesión a todas las vistas locales
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// --- RUTAS DE APLICACIÓN ---
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.render('login');
});

// Post de login real con Bcrypt
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
       return res.render('login', { error: 'Usuario no encontrado' });
    }
    
    // Comparar la contraseña ingresada con la hasheada en DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
       return res.render('login', { error: 'Contraseña incorrecta' });
    }

    // Login exitoso
    req.session.user = { id: user.id, role: user.role, name: user.username };
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).send('Error en el servidor durante el login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Ruta del dashboard
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const searchQuery = req.query.q ? req.query.q.trim() : '';

    if (searchQuery) {
      // Requerimiento de auditoría extrema: guardar huella de las búsquedas
      await AuditLog.create({
        userId: req.session.user.id,
        action: `Búsqueda (Filtro: ${searchQuery})`,
        ipAddress: req.ip
      });
    }

    const whereClause = searchQuery ? {
      [Op.or]: [
        { firstName: { [Op.like]: `%${searchQuery}%` } },
        { lastName: { [Op.like]: `%${searchQuery}%` } },
        { rut: { [Op.like]: `%${searchQuery}%` } }
      ]
    } : {};

    // Buscar pacientes con filtro (si existe) e incluir sus estudios
    const patients = await Patient.findAll({
      where: whereClause,
      include: [Study],
      order: [['lastName', 'ASC']]
    });
    
    res.render('dashboard', { patients, searchQuery });
  } catch (err) {
    console.error('Error cargando dashboard', err);
    res.status(500).send('Error del servidor');
  }
});

// Rutas protegidas para estudios y visualización
const dicomRouter = express.Router();
dicomRouter.use(isAuthenticated); 

dicomRouter.get('/visualizar/:studyId', auditMiddleware('Visualización'), viewDicom);
dicomRouter.get('/descargar/:studyId', auditMiddleware('Descarga'), downloadDicom);

app.use('/dicom', dicomRouter);

// === RUTAS DEL MÓDULO ADMINISTRADOR === //
const adminRouter = express.Router();
adminRouter.use(isAuthenticated, isAdmin); // Protegidas al máximo

adminRouter.get('/users', adminController.getUsers);
adminRouter.get('/users/create', adminController.getCreateUserForm);
adminRouter.post('/users/create', adminController.createUser);
adminRouter.post('/users/delete/:userId', adminController.deleteUser);
adminRouter.get('/users/audit/:userId', adminController.getUserAudit);

app.use('/admin', adminRouter);

// Sincronizar DB e iniciar servidor
sequelize.sync({ alter: true }).then(() => {
  console.log('Base de datos conectada y sincronizada (Modelos y Sesiones).');
  app.listen(PORT, () => {
    console.log(`Servidor Visor DICOM corriendo en http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Error al iniciar la DB:', err);
});
