/**
 * =====================================================
 * CONTROLADOR DE RECOMPENSAS
 * =====================================================
 * Archivo: src/controllers/recompensaController.js
 * Descripción: CRUD de recompensas (solo empresas)
 *              - Crear, listar, actualizar, eliminar
 * =====================================================
 */

const Recompensa = require('../models/Recompensa');

class RecompensaController {
  /**
   * Crear nueva recompensa
   * POST /api/recompensas
   */
  async crear(req, res) {
    try {
      const { nombre, descripcion, puntosRequeridos, stock, categoria, imagen } = req.body;

      // Validaciones
      if (!nombre || !puntosRequeridos) {
        return res.status(400).json({
          success: false,
          mensaje: 'Nombre y puntos requeridos son obligatorios'
        });
      }

      if (puntosRequeridos < 1) {
        return res.status(400).json({
          success: false,
          mensaje: 'Los puntos requeridos deben ser al menos 1'
        });
      }

      // Crear recompensa
      const recompensa = new Recompensa({
        empresa: req.usuario._id,
        nombre,
        descripcion: descripcion || '',
        puntosRequeridos,
        stock: stock !== undefined ? stock : -1,
        categoria: categoria || 'otro',
        imagen: imagen || null
      });

      await recompensa.save();

      res.status(201).json({
        success: true,
        mensaje: 'Recompensa creada exitosamente',
        data: recompensa
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        const errores = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          mensaje: 'Error de validación',
          errores
        });
      }

      console.error('Error al crear recompensa:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Listar recompensas de la empresa autenticada
   * GET /api/recompensas/mis-recompensas
   */
  async listarPropias(req, res) {
    try {
      const { activo, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const filtro = { empresa: req.usuario._id };
      if (activo !== undefined) {
        filtro.activo = activo === 'true';
      }

      const [recompensas, total] = await Promise.all([
        Recompensa.find(filtro)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Recompensa.countDocuments(filtro)
      ]);

      res.status(200).json({
        success: true,
        data: {
          recompensas,
          paginacion: {
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            porPagina: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al listar recompensas:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Listar todas las recompensas disponibles (para clientes)
   * GET /api/recompensas
   */
  async listarDisponibles(req, res) {
    try {
      const { empresaId, categoria, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Filtro base: activas y con stock
      const filtro = { 
        activo: true,
        $or: [
          { stock: -1 },        // Ilimitado
          { stock: { $gt: 0 } } // Con stock disponible
        ]
      };
      
      // Filtros opcionales
      if (empresaId) {
        filtro.empresa = empresaId;
      }
      if (categoria) {
        filtro.categoria = categoria;
      }

      const [recompensas, total] = await Promise.all([
        Recompensa.find(filtro)
          .populate('empresa', 'nombreEmpresa telefono')
          .sort({ puntosRequeridos: 1 }) // Ordenar por puntos (menor a mayor)
          .skip(skip)
          .limit(parseInt(limit)),
        Recompensa.countDocuments(filtro)
      ]);

      res.status(200).json({
        success: true,
        data: {
          recompensas,
          paginacion: {
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            porPagina: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al listar recompensas:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener detalle de una recompensa
   * GET /api/recompensas/:id
   */
  async obtenerPorId(req, res) {
    try {
      const recompensa = await Recompensa.findById(req.params.id)
        .populate('empresa', 'nombreEmpresa telefono email');

      if (!recompensa) {
        return res.status(404).json({
          success: false,
          mensaje: 'Recompensa no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        data: recompensa
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          mensaje: 'ID de recompensa inválido'
        });
      }

      console.error('Error al obtener recompensa:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar recompensa (solo la empresa dueña)
   * PUT /api/recompensas/:id
   */
  async actualizar(req, res) {
    try {
      const { nombre, descripcion, puntosRequeridos, stock, categoria, activo, imagen } = req.body;

      // Buscar recompensa (solo si pertenece a esta empresa)
      const recompensa = await Recompensa.findOne({
        _id: req.params.id,
        empresa: req.usuario._id
      });

      if (!recompensa) {
        return res.status(404).json({
          success: false,
          mensaje: 'Recompensa no encontrada o no tienes permiso para editarla'
        });
      }

      // Actualizar campos si se proporcionan
      if (nombre !== undefined) recompensa.nombre = nombre;
      if (descripcion !== undefined) recompensa.descripcion = descripcion;
      if (puntosRequeridos !== undefined) recompensa.puntosRequeridos = puntosRequeridos;
      if (stock !== undefined) recompensa.stock = stock;
      if (categoria !== undefined) recompensa.categoria = categoria;
      if (activo !== undefined) recompensa.activo = activo;
      if (imagen !== undefined) recompensa.imagen = imagen;

      await recompensa.save();

      res.status(200).json({
        success: true,
        mensaje: 'Recompensa actualizada correctamente',
        data: recompensa
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        const errores = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          mensaje: 'Error de validación',
          errores
        });
      }

      console.error('Error al actualizar recompensa:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Eliminar recompensa (solo la empresa dueña)
   * DELETE /api/recompensas/:id
   */
  async eliminar(req, res) {
    try {
      const recompensa = await Recompensa.findOneAndDelete({
        _id: req.params.id,
        empresa: req.usuario._id
      });

      if (!recompensa) {
        return res.status(404).json({
          success: false,
          mensaje: 'Recompensa no encontrada o no tienes permiso para eliminarla'
        });
      }

      res.status(200).json({
        success: true,
        mensaje: 'Recompensa eliminada correctamente',
        data: {
          id: recompensa._id,
          nombre: recompensa.nombre
        }
      });

    } catch (error) {
      console.error('Error al eliminar recompensa:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new RecompensaController();