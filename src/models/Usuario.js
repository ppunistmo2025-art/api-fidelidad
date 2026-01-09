/**
 * =====================================================
 * MODELO DE USUARIO - Cliente y Empresa
 * =====================================================
 * Archivo: src/models/Usuario.js
 * Descripción: Schema unificado para clientes y empresas
 *              con encriptación de password usando bcrypt
 * =====================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  // ===== TIPO DE USUARIO =====
  tipoUsuario: {
    type: String,
    enum: ['cliente', 'empresa'],
    required: [true, 'El tipo de usuario es obligatorio']
  },

  // ===== CAMPOS COMUNES =====
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No incluir en consultas por defecto
  },
  telefono: {
    type: String,
    required: [true, 'El teléfono es obligatorio'],
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  },

  // ===== CAMPOS EXCLUSIVOS DE CLIENTE =====
  nombre: {
    type: String,
    trim: true,
    required: function() { 
      return this.tipoUsuario === 'cliente'; 
    }
  },
  curp: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    required: function() { 
      return this.tipoUsuario === 'cliente'; 
    }
  },
  puntos: {
    type: Number,
    default: 0,
    min: 0
  },

  // ===== PUNTOS DESGLOSADOS POR EMPRESA (CLIENTES) =====
  puntosPorEmpresa: [{
    empresa: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Usuario',
      required: true 
    },
    puntos: { 
      type: Number, 
      default: 0 
    },
    ultimaTransaccion: {
      type: Date,
      default: Date.now
    }
  }],

  // ===== CAMPOS EXCLUSIVOS DE EMPRESA =====
  nombreEmpresa: {
    type: String,
    trim: true,
    required: function() { 
      return this.tipoUsuario === 'empresa'; 
    }
  },
  rfc: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    required: function() { 
      return this.tipoUsuario === 'empresa'; 
    }
  },
  totalTransacciones: {
    type: Number,
    default: 0
  },
  totalIngresos: {
    type: Number,
    default: 0
  },
  
  // Configuración de puntos personalizada por empresa
  configuracionPuntos: {
    // Por cada X pesos gastados...
    gastoRequerido: {
      type: Number,
      default: 100,
      min: [1, 'El gasto requerido debe ser al menos 1']
    },
    // ...se otorgan Y puntos
    puntosOtorgados: {
      type: Number,
      default: 1,
      min: [1, 'Los puntos otorgados deben ser al menos 1']
    }
  },

  // ===== CAMPO PARA WEBSOCKET =====
  socketId: {
    type: String,
    default: null
  }

}, {
  timestamps: true,
  versionKey: false
});

// ===== MIDDLEWARE: Encriptar password antes de guardar =====
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ===== MÉTODO: Comparar password =====
usuarioSchema.methods.compararPassword = async function(passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

// ===== MÉTODO: Obtener nombre a mostrar =====
usuarioSchema.methods.getNombreMostrar = function() {
  return this.tipoUsuario === 'cliente' ? this.nombre : this.nombreEmpresa;
};

// ===== ÍNDICES =====
usuarioSchema.index({ tipoUsuario: 1 });
usuarioSchema.index({ 'puntosPorEmpresa.empresa': 1 });

module.exports = mongoose.model('Usuario', usuarioSchema);