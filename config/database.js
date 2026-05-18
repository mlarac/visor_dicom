import { Sequelize } from 'sequelize';

// Configuración de la conexión a SQL Server
const sequelize = new Sequelize('MiGlobal', 'sa', 'marcelo1996', {
  host: 'DESKTOP-E9CJSOE',
  dialect: 'mssql',
  port: '1433',
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
