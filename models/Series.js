import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Series = sequelize.define('Series', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'Series_Inc_ID'
  },
  studyId: {
    type: DataTypes.INTEGER,
    field: 'Study_inc_ID_det'
  },
  seriesPatientId: {
    type: DataTypes.STRING,
    field: 'Series_Patient_ID'
  },
  seriesStudyUid: {
    type: DataTypes.STRING,
    field: 'Series_Study_UID'
  },
  seriesUid: {
    type: DataTypes.STRING,
    field: 'Series_UID'
  },
  seriesNumber: {
    type: DataTypes.INTEGER,
    field: 'Series_Number'
  },
  seriesInstances: {
    type: DataTypes.INTEGER,
    field: 'Series_Instances'
  },
  seriesDateTime: {
    type: DataTypes.DATE,
    field: 'Series_Date_Time'
  },
  modality: {
    type: DataTypes.STRING,
    field: 'Modality'
  },
  machine: {
    type: DataTypes.STRING,
    field: 'Machine'
  },
  bodyPart: {
    type: DataTypes.STRING,
    field: 'Body_Part'
  },
  procedureName: {
    type: DataTypes.STRING,
    field: 'procedure_name'
  },
  contrast: {
    type: DataTypes.STRING,
    field: 'Contrast'
  },
  description: {
    type: DataTypes.STRING,
    field: 'Series_Descripition'
  },
  status: {
    type: DataTypes.STRING,
    field: 'Series_Status'
  },
  directoryPath: {
    type: DataTypes.STRING,
    field: 'Series_Directory'
  },
  repetitionTime: {
    type: DataTypes.FLOAT,
    field: 'Repetition_Time'
  },
  echoTime: {
    type: DataTypes.FLOAT,
    field: 'Echo_Time'
  },
  imageOrientation: {
    type: DataTypes.STRING,
    field: 'Image_Orientation'
  },
  viewPosition: {
    type: DataTypes.STRING,
    field: 'View_Position'
  }
}, {
  tableName: 'series',
  timestamps: false
});

export default Series;
