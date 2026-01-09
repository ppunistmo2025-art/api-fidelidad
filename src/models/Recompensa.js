/**
 * =====================================================
 * MODELO DE RECOMPENSA
 * =====================================================
 * Archivo: src/models/Recompensa.js
 * Descripción: Productos/servicios que las empresas
 *              ofrecen para canjear por puntos
 * =====================================================
 */

const mongoose = require('mongoose');

const recompensaSchema = new mongoose.Schema({
  // Empresa dueña de la recompensa
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  
  // Nombre de la recompensa
  nombre: {
    type: String,
    required: [true, 'El nombre de la recompensa es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  
  // Descripción
  descripcion: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  
  // Puntos necesarios para canjear
  puntosRequeridos: {
    type: Number,
    required: [true, 'Los puntos requeridos son obligatorios'],
    min: [1, 'Debe requerir al menos 1 punto']
  },
  
  // Stock disponible (-1 = ilimitado)
  stock: {
    type: Number,
    default: -1,
    min: -1
  },
  
  // URL de imagen (opcional)
  imagen: {
    type: String,
    default: null
  },
  
  // Si está activa/disponible
  activo: {
    type: Boolean,
    default: true
  },
  
  // Categoría
  categoria: {
    type: String,
    enum: ['descuento', 'producto', 'servicio', 'otro'],
    default: 'otro'
  },
  
  // Contador de canjes realizados
  canjesRealizados: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  versionKey: false
});

// ===== ÍNDICES =====
recompensaSchema.index({ empresa: 1, activo: 1 });
recompensaSchema.index({ puntosRequeridos: 1 });
recompensaSchema.index({ categoria: 1 });

// ===== MÉTODO: Verificar si hay stock =====
recompensaSchema.methods.tieneStock = function() {
  return this.stock === -1 || this.stock > 0;
};

module.exports = mongoose.model('Recompensa', recompensaSchema);