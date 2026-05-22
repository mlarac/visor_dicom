import express from 'express';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const SequelizeStore = ConnectSessionSequelize(session.Store);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { sequelize } from './models/index.js';
import routes from './routes/index.js';

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
  secret: process.env.SESSION_SECRET, // En producción, usar variable de entorno
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
app.use('/', routes);

// Sincronizar DB e iniciar servidor
sequelize.sync().then(() => {
  console.log('Base de datos conectada y sincronizada (Modelos y Sesiones).');
  app.listen(PORT, () => {
    console.log(`Servidor Visor DICOM corriendo en http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Error al iniciar la DB:', err);
});
