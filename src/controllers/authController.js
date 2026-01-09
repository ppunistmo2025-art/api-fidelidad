/**
 * =====================================================
 * CONTROLADOR DE AUTENTICACIÓN
 * =====================================================
 * Archivo: src/controllers/authController.js
 * Descripción: Registro, login y perfil de usuarios
 *              Usa JWT para autenticación
 *              Usa bcrypt para encriptar passwords
 * =====================================================
 */

const Usuario = require('../models/Usuario');
const { generarToken } = require('../middleware/auth');

class AuthController {
  /**
   * Registrar nuevo usuario (cliente o empresa)
   * POST /api/auth/registro
   */
  async registro(req, res) {
    try {
      const { tipoUsuario, email, password, telefono } = req.body;

      // ===== VALIDACIONES BÁSICAS =====
      
      // Validar tipo de usuario
      if (!tipoUsuario || !['cliente', 'empresa'].includes(tipoUsuario)) {
        return res.status(400).json({
          success: false,
          mensaje: 'Tipo de usuario inválido. Debe ser "cliente" o "empresa"'
        });
      }

      // Validar campos obligatorios comunes
      if (!email || !password || !telefono) {
        return res.status(400).json({
          success: false,
          mensaje: 'Campos obligatorios: email, password, telefono'
        });
      }

      // Verificar si el email ya existe
      const emailExistente = await Usuario.findOne({ email: email.toLowerCase() });
      if (emailExistente) {
        return res.status(409).json({
          success: false,
          mensaje: 'Ya existe una cuenta con este email'
        });
      }

      // ===== PREPARAR DATOS DEL USUARIO =====
      
      let datosUsuario = {
        tipoUsuario,
        email,
        password,
        telefono
      };

      // ----- VALIDACIONES PARA CLIENTE -----
      if (tipoUsuario === 'cliente') {
        const { nombre, curp } = req.body;

        if (!nombre || !curp) {
          return res.status(400).json({
            success: false,
            mensaje: 'Para cliente se requiere: nombre, curp'
          });
        }

        // Verificar CURP único
        const curpExistente = await Usuario.findOne({ curp: curp.toUpperCase() });
        if (curpExistente) {
          return res.status(409).json({
            success: false,
            mensaje: 'Ya existe una cuenta con este CURP'
          });
        }

        datosUsuario = {
          ...datosUsuario,
          nombre,
          curp: curp.toUpperCase(),
          puntos: 0
        };
      }

      // ----- VALIDACIONES PARA EMPRESA -----
      if (tipoUsuario === 'empresa') {
        const { nombreEmpresa, rfc } = req.body;

        if (!nombreEmpresa || !rfc) {
          return res.status(400).json({
            success: false,
            mensaje: 'Para empresa se requiere: nombreEmpresa, rfc'
          });
        }

        // Verificar RFC único
        const rfcExistente = await Usuario.findOne({ rfc: rfc.toUpperCase() });
        if (rfcExistente) {
          return res.status(409).json({
            success: false,
            mensaje: 'Ya existe una cuenta con este RFC'
          });
        }

        datosUsuario = {
          ...datosUsuario,
          nombreEmpresa,
          rfc: rfc.toUpperCase(),
          totalTransacciones: 0,
          totalIngresos: 0
        };
      }

      // ===== CREAR USUARIO =====
      const nuevoUsuario = new Usuario(datosUsuario);
      await nuevoUsuario.save();

      // Generar token JWT
      const token = generarToken(nuevoUsuario._id);

      // Preparar respuesta (sin password)
      const usuarioResponse = nuevoUsuario.toObject();
      delete usuarioResponse.password;

      res.status(201).json({
        success: true,
        mensaje: 'Registro exitoso. ¡Bienvenido a Fidelidad Amigo!',
        data: {
          usuario: usuarioResponse,
          token
        }
      });

    } catch (error) {
      // Error de validación de Mongoose
      if (error.name === 'ValidationError') {
        const errores = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          mensaje: 'Error de validación',
          errores
        });
      }

      console.error('Error en registro:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Iniciar sesión
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validar campos
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          mensaje: 'Email y contraseña son obligatorios'
        });
      }

      // Buscar usuario (incluir password para comparar)
      const usuario = await Usuario.findOne({ 
        email: email.toLowerCase() 
      }).select('+password');

      // Usuario no encontrado
      if (!usuario) {
        return res.status(401).json({
          success: false,
          mensaje: 'Credenciales inválidas'
        });
      }

      // Verificar contraseña con bcrypt
      const passwordCorrecta = await usuario.compararPassword(password);

      if (!passwordCorrecta) {
        return res.status(401).json({
          success: false,
          mensaje: 'Credenciales inválidas'
        });
      }

      // Verificar que esté activo
      if (!usuario.activo) {
        return res.status(401).json({
          success: false,
          mensaje: 'Tu cuenta ha sido desactivada. Contacta a soporte.'
        });
      }

      // Generar token JWT
      const token = generarToken(usuario._id);

      // Preparar respuesta (sin password)
      const usuarioResponse = usuario.toObject();
      delete usuarioResponse.password;

      res.status(200).json({
        success: true,
        mensaje: `¡Bienvenido ${usuario.getNombreMostrar()}!`,
        data: {
          usuario: usuarioResponse,
          token
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener perfil del usuario autenticado
   * GET /api/auth/perfil
   */
  async obtenerPerfil(req, res) {
    try {
      const usuario = await Usuario.findById(req.usuario._id);

      if (!usuario) {
        return res.status(404).json({
          success: false,
          mensaje: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: usuario
      });

    } catch (error) {
      console.error('Error al obtener perfil:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar perfil
   * PUT /api/auth/perfil
   */
  async actualizarPerfil(req, res) {
    try {
      const { nombre, nombreEmpresa, telefono } = req.body;
      const usuario = req.usuario;

      // Campos actualizables según tipo
      const actualizaciones = { telefono };

      if (usuario.tipoUsuario === 'cliente' && nombre) {
        actualizaciones.nombre = nombre;
      }

      if (usuario.tipoUsuario === 'empresa' && nombreEmpresa) {
        actualizaciones.nombreEmpresa = nombreEmpresa;
      }

      const usuarioActualizado = await Usuario.findByIdAndUpdate(
        usuario._id,
        actualizaciones,
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        mensaje: 'Perfil actualizado correctamente',
        data: usuarioActualizado
      });

    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cambiar contraseña
   * PUT /api/auth/cambiar-password
   */
  async cambiarPassword(req, res) {
    try {
      const { passwordActual, passwordNueva } = req.body;

      if (!passwordActual || !passwordNueva) {
        return res.status(400).json({
          success: false,
          mensaje: 'Se requiere contraseña actual y nueva'
        });
      }

      if (passwordNueva.length < 6) {
        return res.status(400).json({
          success: false,
          mensaje: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      // Obtener usuario con password
      const usuario = await Usuario.findById(req.usuario._id).select('+password');

      // Verificar contraseña actual
      const passwordCorrecta = await usuario.compararPassword(passwordActual);

      if (!passwordCorrecta) {
        return res.status(401).json({
          success: false,
          mensaje: 'Contraseña actual incorrecta'
        });
      }

      // Actualizar contraseña (se encriptará automáticamente)
      usuario.password = passwordNueva;
      await usuario.save();

      // Generar nuevo token
      const token = generarToken(usuario._id);

      res.status(200).json({
        success: true,
        mensaje: 'Contraseña actualizada correctamente',
        data: { token }
      });

    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AuthController();