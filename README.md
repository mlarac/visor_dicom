# Visor DICOM - Aplicación Médica

## Descripción
Visor DICOM es una aplicación web profesional y segura orientada a la gestión y visualización en tiempo real de imágenes médicas en formato DICOM. Cuenta con un dashboard de pacientes con capacidad de búsqueda, un sistema robusto de autenticación, gestión de sesiones y trazabilidad estricta de auditoría para todas las acciones que realizan los usuarios.

## Arquitectura Principal
La aplicación está construida sobre el patrón de diseño **MVC (Modelo-Vista-Controlador)** en Node.js, estructurado de la siguiente manera:

- **Modelos (`models/`)**: Definen la estructura de la base de datos y las relaciones entre entidades (User, Patient, Study, AuditLog) utilizando el ORM Sequelize.
- **Vistas (`views/`)**: Plantillas renderizadas en el lado del servidor usando EJS, complementadas con Bootstrap 5 para proporcionar una interfaz de usuario limpia, responsiva y de aspecto corporativo.
- **Controladores (`controllers/`)**: Contienen la lógica de negocio. Procesan las peticiones HTTP del cliente (ej. inicio de sesión, visualización/descarga de estudios, administración de usuarios) y coordinan el flujo de datos entre los modelos y las vistas.

### Estructura de Directorios Destacada:
- **`middlewares/`**: Funciones intermedias para la protección de rutas (autenticación y validación de roles como `isAdmin`) y el registro automático de auditoría en la base de datos.
- **`public/`**: Recursos estáticos (CSS, JS). Aquí se ubica la lógica del lado del cliente que integra el visor médico.
- **`dicom_storage/`**: Almacenamiento local para los archivos `.dcm`.
- **`config/`**: Archivos de configuración para la conexión con la base de datos SQL Server.

## Tecnologías Utilizadas

### Backend
- **[Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/es/)**: Entorno de ejecución y framework web principal (`express v5.2`).
- **[SQL Server](https://www.microsoft.com/sql-server/)**: Motor de base de datos relacional.
- **[Sequelize](https://sequelize.org/)**: ORM empleado para interactuar de forma segura con SQL Server, manejar migraciones y sincronizar modelos.
- **Seguridad y Gestión de Sesiones**: 
  - `bcrypt`: Para el almacenamiento de contraseñas mediante hashing seguro.
  - `express-session`: Gestión de sesiones de usuario con mitigación contra ataques XSS y CSRF.
  - `connect-session-sequelize`: Persistencia de las sesiones del usuario directamente en la base de datos, evitando cierres de sesión en reinicios del servidor.
- **Trazabilidad de Auditoría**: Registro extremo de eventos en base de datos de acciones como visualizaciones de DICOM, descargas o incluso búsquedas por filtros.

### Frontend
- **[EJS (Embedded JavaScript templating)](https://ejs.co/)**: Motor de plantillas para inyectar datos del backend dinámicamente en el HTML.
- **[Bootstrap 5](https://getbootstrap.com/) & Bootstrap Icons**: Framework CSS utilizado para asegurar un diseño adaptable, moderno e intuitivo en todos los dispositivos.
- **[Cornerstone.js](https://github.com/cornerstonejs/cornerstone)**: Ecosistema de librerías médicas de código abierto especializadas para el renderizado de archivos DICOM en el navegador:
  - `cornerstone-core`: Motor principal de visualización.
  - `cornerstone-tools`: Herramientas interactivas de manipulación de la imagen médica (zoom, paneo, ajuste de ventana/nivel, medidas, etc.).
  - `cornerstone-wado-image-loader`: Cargador de imágenes compatible con el estándar DICOM P10.
  - `dicom-parser`: Para la lectura de metadatos del estándar DICOM.

## Puesta en Marcha

1. Asegúrate de tener Node.js y SQL Server instalados y corriendo en tu entorno.
2. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las credenciales de tu base de datos (revisa el directorio `config/`).
4. Inicia el servidor. La base de datos se sincronizará automáticamente (`{ alter: true }`):
   ```bash
   node server.js
   ```
5. Accede desde tu navegador a `http://localhost:3000`.
