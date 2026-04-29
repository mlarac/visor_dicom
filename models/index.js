import sequelize from '../config/database.js';

import User from './User.js';
import Patient from './Patient.js';
import Study from './Study.js';
import AuditLog from './AuditLog.js';

// Definir asociaciones
// Un paciente tiene muchos estudios (1:N)
Patient.hasMany(Study, { foreignKey: 'PatientId' });
Study.belongsTo(Patient, { foreignKey: 'PatientId' });

// Un usuario genera muchos logs de auditoría (1:N)
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

// Sincronización de modelos con la DB (descomentar para crear tablas, o usar migrations)
// sequelize.sync({ alter: true });

export {
  sequelize,
  User,
  Patient,
  Study,
  AuditLog
};
