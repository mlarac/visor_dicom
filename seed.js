import { sequelize, User, Patient, Study } from './models/index.js';
import fs from 'fs';
import path from 'path';

async function seed() {
  try {
    console.log('1. Sincronizando Modelo de Usuario...');
    await User.sync();
    // Limpiamos los datos con destroy para no violar las llaves foráneas de auditoría
    await User.destroy({ where: {}, truncate: false });
    console.log('✅ Tabla de usuarios sincronizada y limpiada correctamente.');

    console.log('2. Creando Usuarios...');
    await User.create({
      username: 'admin',
      password: 'adminpassword',
      role: 'Admin'
    });

    const house = await User.create({
      username: 'dr.house',
      password: 'password123',
      role: 'Usuario'
    });

    const grey = await User.create({
      username: 'dra.grey',
      password: 'password123',
      role: 'Usuario'
    });
    console.log('✅ Usuarios creados: "admin", "dr.house" y "dra.grey"');

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
