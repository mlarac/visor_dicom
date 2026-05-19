import { Sequelize } from 'sequelize';

// Configuración de la conexión a SQL Server
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mssql',
    port: process.env.DB_PORT,
  dialectOptions: {
    options: {
      instanceName: 'SQL',
      encrypt: false,
      trustServerCertificate: true,
      cryptoCredentialsDetails: {
        minVersion: 'TLSv1'
      }
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export default sequelize;
