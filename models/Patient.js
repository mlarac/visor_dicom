import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  birthDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  rut: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

export default Patient;
