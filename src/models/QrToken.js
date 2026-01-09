/**
 * =====================================================
 * MODELO DE TOKEN QR
 * =====================================================
 * Archivo: src/models/QrToken.js
 * Descripción: Tokens QR temporales que expiran en 30 seg
 *              MongoDB los elimina automáticamente (TTL)
 * =====================================================
 */

const mongoose = require('mongoose');

const qrTokenSchema = new mongoose.Schema({
  // Token único (UUID)
  token: {
    type: String,
    required: true,
    unique: true
  },
  
  // Cliente dueño del QR
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Snapshot de datos del cliente al generar QR
  datosCliente: {
    nombre: String,
    email: String,
    puntos: Number
  },
  
  // Fecha de expiración
  expiraEn: {
    type: Date,
    required: true
  },
  
  // Si ya fue escaneado/usado
  usado: {
    type: Boolean,
    default: false
  },
  
  // Empresa que lo usó (si aplica)
  usadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  }

}, {
  timestamps: true,
  versionKey: false
});

// ===== TTL INDEX =====
// MongoDB eliminará automáticamente documentos 60 seg después de expiraEn
// Este índice también sirve para búsquedas por expiraEn
qrTokenSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 60 });

// ===== MÉTODO: Verificar si está expirado =====
qrTokenSchema.methods.estaExpirado = function() {
  return new Date() > this.expiraEn;
};

// ===== MÉTODO ESTÁTICO: Limpiar expirados manualmente =====
qrTokenSchema.statics.limpiarExpirados = async function() {
  const resultado = await this.deleteMany({ 
    expiraEn: { $lt: new Date() } 
  });
  return resultado.deletedCount;
};

module.exports = mongoose.model('QrToken', qrTokenSchema);