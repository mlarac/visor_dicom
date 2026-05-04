import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Study = sequelize.define('Study', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  studyType: {
    type: DataTypes.STRING,
    allowNull: false // Ej: 'Radiografía', 'Tomografía', 'Resonancia'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  directoryPath: {
    type: DataTypes.STRING,
    allowNull: false // Oculto al usuario final, representa la ruta física del directorio
  }
});

export default Study;
