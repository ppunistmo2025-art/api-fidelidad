/**
 * =====================================================
 * CONTROLADOR DE CLIENTE
 * =====================================================
 * Archivo: src/controllers/clienteController.js
 * Descripción: Acciones exclusivas para clientes
 *              - Generar QR
 *              - Ver puntos
 *              - Historial de transacciones
 * =====================================================
 */

const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const Canje = require('../models/Canje');
const qrService = require('../services/qrService');

class ClienteController {
  /**
   * Generar código QR para el cliente
   * POST /api/cliente/generar-qr
   */
  async generarQR(req, res) {
    try {
      const cliente = req.usuario;

      // Verificar que sea cliente
      if (cliente.tipoUsuario !== 'cliente') {
        return res.status(403).json({
          success: false,
          mensaje: 'Solo los clientes pueden generar códigos QR'
        });
      }

      // Generar QR usando el servicio
      const resultadoQR = await qrService.generarQR(cliente);

      res.status(200).json({
        success: true,
        mensaje: `Código QR generado. Expira en ${resultadoQR.expirationSeconds} segundos`,
        data: resultadoQR
      });

    } catch (error) {
      console.error('Error al generar QR:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error al generar código QR'
      });
    }
  }

  /**
   * Obtener puntos actuales del cliente
   * GET /api/cliente/puntos
   */
  async obtenerPuntos(req, res) {
    try {
      // Obtener datos actualizados
      const cliente = await Usuario.findById(req.usuario._id);

      res.status(200).json({
        success: true,
        data: {
          nombre: cliente.nombre,
          puntos: cliente.puntos,
          email: cliente.email
        }
      });

    } catch (error) {
      console.error('Error al obtener puntos:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener historial de transacciones del cliente
   * GET /api/cliente/historial
   */
  async obtenerHistorial(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Buscar transacciones del cliente
      const [transacciones, total] = await Promise.all([
        Transaccion.find({ cliente: req.usuario._id })
          .populate('empresa', 'nombreEmpresa')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Transaccion.countDocuments({ cliente: req.usuario._id })
      ]);

      res.status(200).json({
        success: true,
        data: {
          transacciones,
          paginacion: {
            total,
            pagina: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            porPagina: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener historial:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener resumen del cliente (dashboard)
   * GET /api/cliente/resumen
   */
  async obtenerResumen(req, res) {
    try {
      const cliente = await Usuario.findById(req.usuario._id);

      // Estadísticas agregadas
      const stats = await Transaccion.aggregate([
        { $match: { cliente: cliente._id } },
        {
          $group: {
            _id: null,
            totalCompras: { $sum: '$monto' },
            totalTransacciones: { $sum: 1 },
            puntosAcumulados: { $sum: '$puntosOtorgados' }
          }
        }
      ]);

      // Últimas 5 transacciones
      const ultimasTransacciones = await Transaccion.find({ 
        cliente: cliente._id 
      })
        .populate('empresa', 'nombreEmpresa')
        .sort({ createdAt: -1 })
        .limit(5);

      // Canjes pendientes
      const canjesPendientes = await Canje.countDocuments({
        cliente: cliente._id,
        estado: 'pendiente'
      });

      res.status(200).json({
        success: true,
        data: {
          cliente: {
            id: cliente._id,
            nombre: cliente.nombre,
            email: cliente.email,
            puntos: cliente.puntos,
            miembroDesde: cliente.createdAt
          },
          estadisticas: stats[0] || {
            totalCompras: 0,
            totalTransacciones: 0,
            puntosAcumulados: 0
          },
          canjesPendientes,
          ultimasTransacciones
        }
      });

    } catch (error) {
      console.error('Error al obtener resumen:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener puntos desglosados por empresa
   * GET /api/cliente/puntos-empresas
   */
  async obtenerPuntosEmpresas(req, res) {
    try {
      const cliente = await Usuario.findById(req.usuario._id)
        .populate('puntosPorEmpresa.empresa', 'nombreEmpresa email telefono');

      if (!cliente) {
        return res.status(404).json({
          success: false,
          mensaje: 'Cliente no encontrado'
        });
      }

      // Verificar que puntosPorEmpresa existe
      if (!cliente.puntosPorEmpresa || cliente.puntosPorEmpresa.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            puntosTotal: cliente.puntos,
            empresas: [],
            totalEmpresas: 0
          }
        });
      }

      // Formatear respuesta
      const puntosEmpresas = cliente.puntosPorEmpresa
        .filter(pe => pe.empresa) // Filtrar empresas eliminadas
        .map(pe => ({
          empresaId: pe.empresa._id,
          nombreEmpresa: pe.empresa.nombreEmpresa,
          telefono: pe.empresa.telefono,
          puntos: pe.puntos,
          ultimaTransaccion: pe.ultimaTransaccion
        }))
        .sort((a, b) => b.puntos - a.puntos); // Ordenar por más puntos

      res.status(200).json({
        success: true,
        data: {
          puntosTotal: cliente.puntos,
          empresas: puntosEmpresas,
          totalEmpresas: puntosEmpresas.length
        }
      });

    } catch (error) {
      console.error('Error al obtener puntos por empresa:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener puntos por empresa'
      });
    }
  }
}

module.exports = new ClienteController();