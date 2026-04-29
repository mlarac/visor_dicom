import mysql from 'mysql2/promise';
import { sequelize, User, Patient, Study } from './models/index.js';

async function seed() {
  try {
    console.log('1. Conectando a MySQL para verificar la base de datos...');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    
    // Creamos la base de datos si no existe
    await connection.query('CREATE DATABASE IF NOT EXISTS visor_dicom;');
    console.log('✅ Base de datos "visor_dicom" garantizada.');
    await connection.end();

    console.log('2. Sincronizando Modelos de Sequelize...');
    // force: true destruye las tablas y las crea de nuevo (Ideal para resetear datos de prueba)
    await sequelize.sync({ force: true });
    console.log('✅ Tablas sincronizadas y estructuradas correctamente.');

    console.log('3. Creando Usuarios...');
    await User.create({
      username: 'admin',
      password: 'adminpassword',
      role: 'Admin'
    });
    
    const house = await User.create({
      username: 'dr.house',
      password: 'password123',
      role: 'Doctor'
    });

    const grey = await User.create({
      username: 'dra.grey',
      password: 'password123',
      role: 'Doctor'
    });
    console.log('✅ Usuarios creados: "admin", "dr.house" y "dra.grey"');

    console.log('4. Creando Pacientes de prueba...');
    const p1 = await Patient.create({
      firstName: 'Juan',
      lastName: 'Pérez García',
      birthDate: '1980-05-15',
      rut: '11222333-4'
    });

    const p2 = await Patient.create({
      firstName: 'María Elena',
      lastName: 'González López',
      birthDate: '1992-11-20',
      rut: '15666777-K'
    });

    const p3 = await Patient.create({
      firstName: 'Carlos',
      lastName: 'Méndez',
      birthDate: '1975-01-30',
      rut: '9988844-3'
    });
    console.log('✅ 3 Pacientes creados.');

    console.log('5. Asignando Estudios DICOM a Pacientes...');
    await Study.bulkCreate([
      {
        studyType: 'Radiografía de Tórax Frontal',
        date: '2023-01-10',
        filePath: './dicom_storage/rx_torax.dcm',
        PatientId: p1.id
      },
      {
        studyType: 'Tomografía Computarizada, Cerebro',
        date: '2023-06-22',
        filePath: './dicom_storage/tc_cerebro.dcm',
        PatientId: p1.id
      },
      {
        studyType: 'Ecografía Abdominal Completa',
        date: '2023-08-05',
        filePath: './dicom_storage/eco_abdom.dcm',
        PatientId: p2.id
      }
    ]);
    console.log('✅ Estudios asignados.');

    console.log('\n=============================================');
    console.log('🚀 SEED Y CONFIGURACIÓN COMPLETADOS CON ÉXITO');
    console.log('Base de datos lista para pruebas.');
    console.log('Puedes testear el sistema usando la cuenta de Doctor:');
    console.log('➤ Usuario: dr.house');
    console.log('➤ Clave: password123');
    console.log('=============================================\n');

  } catch (error) {
    console.error('❌ Error crítico durante el aprovisionamiento (SEED):', error);
  } finally {
    process.exit();
  }
}

seed();
