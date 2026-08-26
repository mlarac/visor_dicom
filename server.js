import express from 'express';
import session from 'express-session';
import ConnectSessionSequelize from 'connect-session-sequelize';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import helmet from 'helmet';

const SequelizeStore = ConnectSessionSequelize(session.Store);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { sequelize } from './models/index.js';
import routes from './routes/index.js';

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad HTTP con Helmet
const isHttps = process.env.COOKIE_SECURE === 'true';

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
  scriptSrcElem: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "blob:"],
  connectSrc: ["'self'", "blob:"],
  workerSrc: ["'self'", "blob:"],
  fontSrc: ["'self'", "data:"],
  objectSrc: ["'none'"]
};

// En HTTP, eliminar upgrade-insecure-requests del CSP (Helmet v8 lo incluye por defecto)
if (!isHttps) {
  cspDirectives.upgradeInsecureRequests = null;
}

app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    crossOriginEmbedderPolicy: false,
    // HSTS solo tiene sentido con HTTPS; en HTTP bloquea la carga de recursos
    strictTransportSecurity: isHttps
  })
);

// Configuración de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares básicos
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules'), { maxAge: '7d', etag: true }));


// Configuración de la Sesión con connect-session-sequelize
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'Sessions', // Por defecto crearía 'Sessions'
  checkExpirationInterval: 5 * 60 * 1000, // Limpiar sesiones expiradas cada 5 min
  expiration: 30 * 60 * 1000 // Expiración por inactividad tras 30 minutos
});

app.use(session({
  secret: process.env.SESSION_SECRET, // En producción, usar variable de entorno
  store: sessionStore,
  resave: false, // No guardar si no hubo cambios
  saveUninitialized: false, // No guardar sesiones vacías
  rolling: true, // Renueva la expiración de la cookie con cada interacción
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true', // true solo si se usa HTTPS (configurable en .env)
    httpOnly: true, // Protege contra XSS
    sameSite: 'lax', // Protege contra CSRF (CSRF Mitigation)
    maxAge: 15 * 60 * 1000 // Expira tras 15 minutos de inactividad
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
try {
  await sequelize.sync();
  console.log('Base de datos conectada y sincronizada (Modelos y Sesiones).');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Visor DICOM corriendo en http://localhost:${PORT}`);
    console.log(`Acceso en red local: http://0.0.0.0:${PORT}`);
  });
} catch (err) {
  console.error('Error al iniciar la DB:', err);
}
