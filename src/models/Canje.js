/**
 * =====================================================
 * MODELO DE CANJE
 * =====================================================
 * Archivo: src/models/Canje.js
 * Descripción: Historial de canjes de puntos
 *              Incluye código único para validar en tienda
 * =====================================================
 */

const mongoose = require('mongoose');

const canjeSchema = new mongoose.Schema({
  // Cliente que canjea
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Recompensa canjeada
  recompensa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recompensa',
    required: true
  },
  
  // Empresa que ofrece la recompensa
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Puntos usados en el canje
  puntosCanjeados: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Puntos antes del canje
  puntosAnteriores: {
    type: Number,
    required: true
  },
  
  // Puntos después del canje
  puntosRestantes: {
    type: Number,
    required: true
  },
  
  // Código único para validar (ej: CJ-A1B2C3D4)
  codigoCanje: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Estado del canje
  estado: {
    type: String,
    enum: ['pendiente', 'entregado', 'cancelado'],
    default: 'pendiente'
  },
  
  // Fecha de entrega (cuando se marca como entregado)
  fechaEntrega: {
    type: Date,
    default: null
  },
  
  // Snapshot de la recompensa al momento del canje
  detalleRecompensa: {
    nombre: String,
    descripcion: String,
    categoria: String
  }

}, {
  timestamps: true,
  versionKey: false
});

// ===== ÍNDICES =====
// Nota: codigoCanje ya tiene unique:true que crea índice automáticamente
canjeSchema.index({ cliente: 1, createdAt: -1 });
canjeSchema.index({ empresa: 1, createdAt: -1 });
canjeSchema.index({ estado: 1 });

module.exports = mongoose.model('Canje', canjeSchema);