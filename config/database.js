import { Sequelize } from 'sequelize';

// Configuración de la conexión a MySQL
const sequelize = new Sequelize('visor_dicom', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false, // Desactiva el log de SQL para consola (opcional)
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export default sequelize;
