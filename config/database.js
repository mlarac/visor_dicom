import { Sequelize } from 'sequelize';

// Configuración de la conexión a SQL Server
const sequelize = new Sequelize('MiGlobal_Historico', 'sa', 'PASSBD', {
  host: 'SAR-PEDRO',
  dialect: 'mssql',
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export default sequelize;
