import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'Pat_Inc_ID'
  },
  rut: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'Pat_ID'
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'Pat_Name'
  },
  birthDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'Pat_birth_datetime'
  },
  sex: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'Pat_sex'
  }
}, {
  tableName: 'Patients',
  timestamps: false
});

export default Patient;
