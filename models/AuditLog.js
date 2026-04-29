import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false // Búsqueda, Visualización, Descarga
  },
  targetPatientId: {
    type: DataTypes.UUID,
    allowNull: true // Opcional, si la acción apunta a un paciente
  },
  targetStudyId: {
    type: DataTypes.INTEGER,
    allowNull: true // Opcional, si la acción apunta a un estudio
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

export default AuditLog;
