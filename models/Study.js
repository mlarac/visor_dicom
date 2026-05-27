import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Study = sequelize.define('Study', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'Study_Inc_ID'
  },
  PatientId: {
    type: DataTypes.INTEGER,
    field: 'Pat_Inc_ID_Det'
  },
  studyId: {
    type: DataTypes.STRING,
    field: 'Study_ID'
  },
  studyUid: {
    type: DataTypes.STRING,
    field: 'Study_UID'
  },
  studyLocation: {
    type: DataTypes.STRING,
    field: 'Study_Location'
  },
  directoryPath: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'Study_Directory'
  },
  branchName: {
    type: DataTypes.STRING,
    field: 'Branch_Name'
  },
  date: {
    type: DataTypes.DATE,
    field: 'Proc_Start'
  },
  studyType: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'Modality_Name'
  },
  machineName: {
    type: DataTypes.STRING,
    field: 'Machine_Name'
  },
  radiologistName: {
    type: DataTypes.STRING,
    field: 'Radiologist_Name'
  },
  studySeries: {
    type: DataTypes.INTEGER,
    field: 'Study_Series'
  },
  studyImages: {
    type: DataTypes.INTEGER,
    field: 'Study_Images'
  },
  studyReports: {
    type: DataTypes.INTEGER,
    field: 'Study_Reports'
  },
  modalitiesInStudy: {
    type: DataTypes.STRING,
    field: 'Modalities_In_Study'
  },
  receivingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'Receiving_Date'
  },
  customerName: {
    type: DataTypes.STRING,
    field: 'Customer_Name'
  },
  institutionName: {
    type: DataTypes.STRING,
    field: 'Institution_Name'
  }
}, {
  tableName: 'Studies',
  timestamps: false
});

export default Study;
