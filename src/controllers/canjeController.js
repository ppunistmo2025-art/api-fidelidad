/**
 * =====================================================
 * CONTROLADOR DE CANJES
 * =====================================================
 * Archivo: src/controllers/canjeController.js
 * Descripción: Canje de puntos por recompensas
 *              - Cliente canjea puntos
 *              - Empresa valida y entrega
 * =====================================================
 */

const Canje = require('../models/Canje');
const Recompensa = require('../models/Recompensa');
const Usuario = require('../models/Usuario');
const notificacionService = require('../services/notificacionService');
const crypto = require('crypto');

function generarCodigoCanje() {
    const bytes = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `CJ-${bytes}`;
  }

class CanjeController {
  /**
   * Generar código único de canje (ej: CJ-A1B2C3D4)
   */


  /**
   * Canjear puntos por una recompensa (solo clientes)
   * POST /api/canjes
   */
  async canjear(req, res) {
    try {
      const { recompensaId } = req.body;
      const cliente = req.usuario;

      // Validar que se proporcione el ID
      if (!recompensaId) {
        return res.status(400).json({
          success: false,
          mensaje: 'El ID de la recompensa es requerido'
        });
      }

      // Obtener recompensa
      const recompensa = await Recompensa.findById(recompensaId)
        .populate('empresa', 'nombreEmpresa');

      if (!recompensa) {
        return res.status(404).json({
          success: false,
          mensaje: 'Recompensa no encontrada'
        });
      }

      // Verificar que esté activa
      if (!recompensa.activo) {
        return res.status(400).json({
          success: false,
          mensaje: 'Esta recompensa ya no está disponible'
        });
      }

      // Verificar stock
      if (recompensa.stock !== -1 && recompensa.stock <= 0) {
        return res.status(400).json({
          success: false,
          mensaje: 'Recompensa agotada'
        });
      }

      // Obtener puntos actuales del cliente
      const clienteActualizado = await Usuario.findById(cliente._id);
      
      // Verificar puntos suficientes (totales)
      if (clienteActualizado.puntos < recompensa.puntosRequeridos) {
        return res.status(400).json({
          success: false,
          mensaje: 'Puntos insuficientes',
          data: {
            puntosActuales: clienteActualizado.puntos,
            puntosRequeridos: recompensa.puntosRequeridos,
            puntosFaltantes: recompensa.puntosRequeridos - clienteActualizado.puntos
          }
        });
      }

      // ===== VERIFICAR PUNTOS DE LA EMPRESA ESPECÍFICA =====
      const empresaId = recompensa.empresa._id.toString();
      
      // Inicializar array si no existe
      if (!clienteActualizado.puntosPorEmpresa) {
        clienteActualizado.puntosPorEmpresa = [];
      }

      const indexEmpresa = clienteActualizado.puntosPorEmpresa.findIndex(
        pe => pe.empresa && pe.empresa.toString() === empresaId
      );

      // Verificar puntos de esa empresa específica
      const puntosEnEmpresa = indexEmpresa >= 0 
        ? clienteActualizado.puntosPorEmpresa[indexEmpresa].puntos 
        : 0;

      if (puntosEnEmpresa < recompensa.puntosRequeridos) {
        return res.status(400).json({
          success: false,
          mensaje: `Puntos insuficientes en ${recompensa.empresa.nombreEmpresa}`,
          data: {
            puntosEnEmpresa,
            puntosRequeridos: recompensa.puntosRequeridos,
            puntosFaltantes: recompensa.puntosRequeridos - puntosEnEmpresa,
            empresa: recompensa.empresa.nombreEmpresa
          }
        });
      }

      // ===== PROCESAR CANJE =====
      
      const puntosAnteriores = clienteActualizado.puntos;
      const puntosRestantes = puntosAnteriores - recompensa.puntosRequeridos;
      const codigoCanje = generarCodigoCanje();

      // Crear registro de canje
      const canje = new Canje({
        cliente: cliente._id,
        recompensa: recompensa._id,
        empresa: recompensa.empresa._id,
        puntosCanjeados: recompensa.puntosRequeridos,
        puntosAnteriores,
        puntosRestantes,
        codigoCanje,
        detalleRecompensa: {
          nombre: recompensa.nombre,
          descripcion: recompensa.descripcion,
          categoria: recompensa.categoria
        }
      });
      await canje.save();

      // ===== RESTAR PUNTOS TOTALES =====
      clienteActualizado.puntos = puntosRestantes;

      // ===== RESTAR PUNTOS DE LA EMPRESA ESPECÍFICA =====
      if (indexEmpresa >= 0) {
        clienteActualizado.puntosPorEmpresa[indexEmpresa].puntos -= recompensa.puntosRequeridos;
        
        // Si quedó en cero o negativo, dejarlo en 0
        if (clienteActualizado.puntosPorEmpresa[indexEmpresa].puntos < 0) {
          clienteActualizado.puntosPorEmpresa[indexEmpresa].puntos = 0;
        }
      }

      await clienteActualizado.save();

      // Actualizar stock de la recompensa
      if (recompensa.stock !== -1) {
        recompensa.stock -= 1;
      }
      recompensa.canjesRealizados += 1;
      await recompensa.save();

      // Notificar a la empresa
      await notificacionService.notificarNuevoCanje(recompensa.empresa._id, {
        codigoCanje,
        clienteNombre: cliente.nombre,
        recompensaNombre: recompensa.nombre
      });

      res.status(201).json({
        success: true,
        mensaje: '¡Canje realizado exitosamente!',
        data: {
          canje: {
            id: canje._id,
            codigoCanje,
            estado: canje.estado,
            recompensa: {
              nombre: recompensa.nombre,
              descripcion: recompensa.descripcion
            },
            empresa: recompensa.empresa.nombreEmpresa
          },
          puntos: {
            anteriores: puntosAnteriores,
            canjeados: recompensa.puntosRequeridos,
            restantes: puntosRestantes
          },
          instrucciones: 'Presenta el código de canje en la tienda para recibir tu recompensa'
        }
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          mensaje: 'ID de recompensa inválido'
        });
      }

      console.error('Error al canjear:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error al procesar el canje'
      });
    }
  }

  /**
   * Listar canjes del cliente
   * GET /api/canjes/mis-canjes
   */
  async listarCanjesCliente(req, res) {
    try {
      const { estado, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const filtro = { cliente: req.usuario._id };
      if (estado) {
        filtro.estado = estado;
      }

      const [canjes, total] = await Promise.all([
        Canje.find(filtro)
          .populate('empresa', 'nombreEmpresa telefono')
          .populate('recompensa', 'nombre imagen')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Canje.countDocuments(filtro)
      ]);

      res.status(200).json({
        success: true,
        data: {
          canjes,
          paginacion: {
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            porPagina: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al listar canjes:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Listar canjes para la empresa
   * GET /api/canjes/empresa
   */
  async listarCanjesEmpresa(req, res) {
    try {
      const { estado, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const filtro = { empresa: req.usuario._id };
      if (estado) {
        filtro.estado = estado;
      }

      const [canjes, total, pendientes] = await Promise.all([
        Canje.find(filtro)
          .populate('cliente', 'nombre email telefono')
          .populate('recompensa', 'nombre')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Canje.countDocuments(filtro),
        Canje.countDocuments({ empresa: req.usuario._id, estado: 'pendiente' })
      ]);

      res.status(200).json({
        success: true,
        data: {
          canjes,
          pendientes,
          paginacion: {
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            porPagina: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al listar canjes:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Validar código de canje
   * GET /api/canjes/validar/:codigo
   */
  async validarCodigo(req, res) {
    try {
      const { codigo } = req.params;

      const canje = await Canje.findOne({
        codigoCanje: codigo.toUpperCase(),
        empresa: req.usuario._id
      })
        .populate('cliente', 'nombre email telefono')
        .populate('recompensa', 'nombre descripcion imagen');

      if (!canje) {
        return res.status(404).json({
          success: false,
          mensaje: 'Código de canje no encontrado'
        });
      }

      if (canje.estado === 'entregado') {
        return res.status(400).json({
          success: false,
          mensaje: 'Este canje ya fue entregado',
          data: { fechaEntrega: canje.fechaEntrega }
        });
      }

      if (canje.estado === 'cancelado') {
        return res.status(400).json({
          success: false,
          mensaje: 'Este canje fue cancelado'
        });
      }

      res.status(200).json({
        success: true,
        mensaje: 'Código válido - Pendiente de entrega',
        data: {
          canje: {
            id: canje._id,
            codigoCanje: canje.codigoCanje,
            estado: canje.estado,
            fechaCanje: canje.createdAt
          },
          cliente: canje.cliente,
          recompensa: canje.detalleRecompensa
        }
      });

    } catch (error) {
      console.error('Error al validar código:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Marcar canje como entregado
   * PUT /api/canjes/:id/entregar
   */
  async marcarEntregado(req, res) {
    try {
      const canje = await Canje.findOne({
        _id: req.params.id,
        empresa: req.usuario._id
      });

      if (!canje) {
        return res.status(404).json({
          success: false,
          mensaje: 'Canje no encontrado'
        });
      }

      if (canje.estado === 'entregado') {
        return res.status(400).json({
          success: false,
          mensaje: 'Este canje ya fue entregado'
        });
      }

      if (canje.estado === 'cancelado') {
        return res.status(400).json({
          success: false,
          mensaje: 'No se puede entregar un canje cancelado'
        });
      }

      // Marcar como entregado
      canje.estado = 'entregado';
      canje.fechaEntrega = new Date();
      await canje.save();

      // Notificar al cliente
      await notificacionService.notificarCanjeEntregado(canje.cliente, {
        recompensaNombre: canje.detalleRecompensa.nombre,
        codigoCanje: canje.codigoCanje
      });

      res.status(200).json({
        success: true,
        mensaje: '¡Canje marcado como entregado!',
        data: canje
      });

    } catch (error) {
      console.error('Error al marcar entregado:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Cancelar canje (devuelve puntos al cliente)
   * PUT /api/canjes/:id/cancelar
   */
  async cancelar(req, res) {
    try {
      const canje = await Canje.findOne({
        _id: req.params.id,
        empresa: req.usuario._id,
        estado: 'pendiente'
      });

      if (!canje) {
        return res.status(404).json({
          success: false,
          mensaje: 'Canje no encontrado o no se puede cancelar'
        });
      }

      const empresaId = canje.empresa.toString();

      // Obtener cliente para actualizar puntosPorEmpresa
      const cliente = await Usuario.findById(canje.cliente);

      // ===== DEVOLVER PUNTOS TOTALES =====
      cliente.puntos += canje.puntosCanjeados;

      // ===== DEVOLVER PUNTOS A LA EMPRESA ESPECÍFICA =====
      if (!cliente.puntosPorEmpresa) {
        cliente.puntosPorEmpresa = [];
      }

      const indexEmpresa = cliente.puntosPorEmpresa.findIndex(
        pe => pe.empresa && pe.empresa.toString() === empresaId
      );

      if (indexEmpresa >= 0) {
        // Ya existe, sumar puntos devueltos
        cliente.puntosPorEmpresa[indexEmpresa].puntos += canje.puntosCanjeados;
        cliente.puntosPorEmpresa[indexEmpresa].ultimaTransaccion = new Date();
      } else {
        // No existe (caso raro), crear entrada
        cliente.puntosPorEmpresa.push({
          empresa: empresaId,
          puntos: canje.puntosCanjeados,
          ultimaTransaccion: new Date()
        });
      }

      await cliente.save();

      // Restaurar stock de la recompensa
      const recompensa = await Recompensa.findById(canje.recompensa);
      if (recompensa) {
        if (recompensa.stock !== -1) {
          recompensa.stock += 1;
        }
        recompensa.canjesRealizados = Math.max(0, recompensa.canjesRealizados - 1);
        await recompensa.save();
      }

      // Actualizar estado del canje
      canje.estado = 'cancelado';
      await canje.save();

      // Notificar al cliente
      await notificacionService.notificarCanjeCancelado(canje.cliente, {
        puntosDevueltos: canje.puntosCanjeados,
        recompensaNombre: canje.detalleRecompensa.nombre
      });

      res.status(200).json({
        success: true,
        mensaje: 'Canje cancelado. Los puntos fueron devueltos al cliente.',
        data: {
          puntosDevueltos: canje.puntosCanjeados
        }
      });

    } catch (error) {
      console.error('Error al cancelar canje:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new CanjeController();