/**
 * =====================================================
 * SERVICIO DE CÓDIGO QR
 * =====================================================
 * Archivo: src/services/qrService.js
 * Descripción: Generación y validación de códigos QR
 *              Los QR expiran en 30 segundos
 * =====================================================
 */

const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const QrToken = require('../models/QrToken');

class QrService {
  constructor() {
    // Tiempo de expiración en segundos (default 30)
    this.expirationSeconds = parseInt(process.env.QR_EXPIRATION_SECONDS) || 30;
  }

  /**
   * Generar código QR para un cliente
   * @param {Object} cliente - Documento del cliente
   * @returns {Object} - Token, imagen QR en base64, fecha de expiración
   */
  async generarQR(cliente) {
    // Generar token único
    const token = uuidv4();
    
    // Calcular fecha de expiración
    const expiraEn = new Date(Date.now() + this.expirationSeconds * 1000);

    // Datos que contendrá el QR (lo que la empresa escaneará)
    const datosQR = {
      token,
      clienteId: cliente._id.toString(),
      nombre: cliente.nombre,
      expiraEn: expiraEn.toISOString()
    };

    // Guardar token en la base de datos
    const qrToken = new QrToken({
      token,
      clienteId: cliente._id,
      datosCliente: {
        nombre: cliente.nombre,
        email: cliente.email,
        puntos: cliente.puntos
      },
      expiraEn
    });
    await qrToken.save();

    // Generar imagen QR en base64
    const qrImageBase64 = await QRCode.toDataURL(JSON.stringify(datosQR), {
      errorCorrectionLevel: 'H', // Alta corrección de errores
      type: 'image/png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      token,
      qrImage: qrImageBase64,
      expiraEn,
      expirationSeconds: this.expirationSeconds,
      cliente: {
        id: cliente._id,
        nombre: cliente.nombre,
        puntos: cliente.puntos
      }
    };
  }

  /**
   * Validar un token QR escaneado por empresa
   * @param {String} token - Token del QR escaneado
   * @returns {Object} - Resultado de validación
   */
  async validarQR(token) {
    // Buscar token en la base de datos
    const qrToken = await QrToken.findOne({ token }).populate('clienteId');

    // Token no encontrado
    if (!qrToken) {
      return {
        valido: false,
        mensaje: 'Código QR no encontrado o inválido',
        codigo: 'QR_NOT_FOUND'
      };
    }

    // Token expirado
    if (qrToken.estaExpirado()) {
      return {
        valido: false,
        mensaje: 'El código QR ha expirado. Pide al cliente que genere uno nuevo.',
        codigo: 'QR_EXPIRED'
      };
    }

    // Token ya usado
    if (qrToken.usado) {
      return {
        valido: false,
        mensaje: 'Este código QR ya fue utilizado',
        codigo: 'QR_USED'
      };
    }

    // Verificar que el cliente existe y está activo
    if (!qrToken.clienteId) {
      return {
        valido: false,
        mensaje: 'Cliente no encontrado',
        codigo: 'CLIENT_NOT_FOUND'
      };
    }

    if (!qrToken.clienteId.activo) {
      return {
        valido: false,
        mensaje: 'La cuenta del cliente está inactiva',
        codigo: 'CLIENT_INACTIVE'
      };
    }

    // QR válido - devolver datos del cliente
    return {
      valido: true,
      mensaje: 'Código QR válido',
      codigo: 'QR_VALID',
      cliente: {
        id: qrToken.clienteId._id,
        nombre: qrToken.clienteId.nombre,
        email: qrToken.clienteId.email,
        puntos: qrToken.clienteId.puntos
      },
      token: qrToken.token
    };
  }

  /**
   * Marcar un token como usado
   * @param {String} token - Token a marcar
   * @param {String} empresaId - ID de la empresa que lo usó
   */
  async marcarComoUsado(token, empresaId) {
    return await QrToken.findOneAndUpdate(
      { token },
      { 
        usado: true, 
        usadoPor: empresaId 
      },
      { new: true }
    );
  }

  /**
   * Obtener estadísticas de QR
   */
  async obtenerEstadisticas() {
    const total = await QrToken.countDocuments();
    const usados = await QrToken.countDocuments({ usado: true });
    const activos = await QrToken.countDocuments({ 
      usado: false, 
      expiraEn: { $gt: new Date() } 
    });

    return { total, usados, activos };
  }
}

module.exports = new QrService();