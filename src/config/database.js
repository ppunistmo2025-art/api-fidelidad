/**
 * =====================================================
 * CONFIGURACIÓN DE BASE DE DATOS - MongoDB Atlas
 * =====================================================
 * Archivo: src/config/database.js
 * Descripción: Conexión y manejo de eventos de MongoDB
 * =====================================================
 */

const mongoose = require('mongoose');

/**
 * Conectar a MongoDB Atlas
 */
const conectarDB = async () => {
  try {
    // Opciones de conexión
    const opciones = {
      // Tiempo máximo para seleccionar servidor
      serverSelectionTimeoutMS: 5000,
      // Tiempo máximo de inactividad del socket
      socketTimeoutMS: 45000,
    };

    // Conectar a MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, opciones);

    console.log(`\n✅ MongoDB Atlas conectado exitosamente`);
    console.log(`   📍 Host: ${conn.connection.host}`);
    console.log(`   📁 Base de datos: ${conn.connection.name}\n`);

    // ===== EVENTOS DE CONEXIÓN =====

    // Error en la conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err.message);
    });

    // Desconexión
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
    });

    // Reconexión
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado');
    });

    return conn;

  } catch (error) {
    console.error('\n❌ Error al conectar a MongoDB Atlas:');
    console.error(`   ${error.message}`);
    
    // Si es error de autenticación
    if (error.message.includes('authentication')) {
      console.error('\n💡 Verifica que:');
      console.error('   1. La contraseña en MONGODB_URI sea correcta');
      console.error('   2. El usuario tenga permisos en la base de datos');
    }
    
    // Si es error de red
    if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      console.error('\n💡 Verifica que:');
      console.error('   1. Tengas conexión a internet');
      console.error('   2. Tu IP esté en la whitelist de MongoDB Atlas');
    }

    process.exit(1);
  }
};

/**
 * Desconectar de MongoDB
 */
const desconectarDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('📴 MongoDB desconectado correctamente');
  } catch (error) {
    console.error('Error al desconectar:', error.message);
  }
};

module.exports = { conectarDB, desconectarDB };