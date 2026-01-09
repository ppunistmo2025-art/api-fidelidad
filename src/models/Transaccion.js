/**
 * =====================================================
 * MODELO DE TRANSACCIÓN
 * =====================================================
 * Archivo: src/models/Transaccion.js
 * Descripción: Historial de puntos otorgados
 *              Registra cada vez que una empresa da puntos
 * =====================================================
 */

const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
  // Cliente que recibe los puntos
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Empresa que otorga los puntos
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Monto de la compra
  monto: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0.01, 'El monto debe ser mayor a 0']
  },
  
  // Puntos otorgados en esta transacción
  puntosOtorgados: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Puntos antes de la transacción
  puntosAnteriores: {
    type: Number,
    required: true
  },
  
  // Puntos después de la transacción
  puntosNuevos: {
    type: Number,
    required: true
  },
  
  // Descripción opcional
  descripcion: {
    type: String,
    default: 'Compra en tienda'
  },
  
  // Token QR usado
  qrToken: {
    type: String,
    required: true
  }

}, {
  timestamps: true,
  versionKey: false
});

// ===== ÍNDICES para búsquedas optimizadas =====
transaccionSchema.index({ cliente: 1, createdAt: -1 });
transaccionSchema.index({ empresa: 1, createdAt: -1 });
transaccionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaccion', transaccionSchema);