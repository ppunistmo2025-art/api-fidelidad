/**
 * =====================================================
 * MIDDLEWARE DE AUTENTICACIÓN - JWT
 * =====================================================
 * Archivo: src/middleware/auth.js
 * Descripción: Verificación de tokens JWT y control
 *              de acceso por tipo de usuario
 * =====================================================
 */

const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Verificar Token JWT
 * Extrae el token del header Authorization y valida
 */
const verificarToken = async (req, res, next) => {
  try {
    let token;

    // Obtener token del header Authorization
    // Formato: "Bearer <token>"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Verificar que existe el token
    if (!token) {
      return res.status(401).json({
        success: false,
        mensaje: 'No autorizado. Token no proporcionado',
        codigo: 'NO_TOKEN'
      });
    }

    try {
      // Verificar y decodificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Buscar usuario en la base de datos
      const usuario = await Usuario.findById(decoded.id);

      // Verificar que el usuario existe
      if (!usuario) {
        return res.status(401).json({
          success: false,
          mensaje: 'El usuario asociado a este token ya no existe',
          codigo: 'USER_NOT_FOUND'
        });
      }

      // Verificar que el usuario está activo
      if (!usuario.activo) {
        return res.status(401).json({
          success: false,
          mensaje: 'Tu cuenta ha sido desactivada',
          codigo: 'USER_INACTIVE'
        });
      }

      // Agregar usuario a la request para uso posterior
      req.usuario = usuario;
      next();

    } catch (jwtError) {
      // Error de JWT inválido
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          mensaje: 'Token inválido',
          codigo: 'INVALID_TOKEN'
        });
      }
      
      // Error de JWT expirado
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          mensaje: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente',
          codigo: 'TOKEN_EXPIRED'
        });
      }

      throw jwtError;
    }

  } catch (error) {
    console.error('Error en verificarToken:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error de autenticación',
      codigo: 'AUTH_ERROR'
    });
  }
};

/**
 * Restringir acceso por tipo de usuario
 * @param {...string} tiposPermitidos - Tipos de usuario permitidos ('cliente', 'empresa')
 */
const restringirA = (...tiposPermitidos) => {
  return (req, res, next) => {
    // Verificar que el usuario tiene un tipo permitido
    if (!tiposPermitidos.includes(req.usuario.tipoUsuario)) {
      return res.status(403).json({
        success: false,
        mensaje: `Acceso denegado. Esta acción es solo para: ${tiposPermitidos.join(', ')}`,
        codigo: 'ACCESS_DENIED',
        tuTipo: req.usuario.tipoUsuario,
        tiposRequeridos: tiposPermitidos
      });
    }
    next();
  };
};

/**
 * Generar Token JWT
 * @param {string} id - ID del usuario
 * @returns {string} Token JWT
 */
const generarToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

/**
 * Decodificar Token (sin verificar)
 * Útil para obtener datos sin validar
 * @param {string} token 
 * @returns {object|null}
 */
const decodificarToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

module.exports = {
  verificarToken,
  restringirA,
  generarToken,
  decodificarToken
};