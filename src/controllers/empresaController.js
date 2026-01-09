/**
 * =====================================================
 * CONTROLADOR DE EMPRESA
 * =====================================================
 * Archivo: src/controllers/empresaController.js
 * Descripción: Acciones exclusivas para empresas
 *              - Leer QR
 *              - Agregar puntos
 *              - Dashboard y estadísticas
 * =====================================================
 */

const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const Canje = require('../models/Canje');
const qrService = require('../services/qrService');
const notificacionService = require('../services/notificacionService');

class EmpresaController {
  /**
   * Validar/Leer código QR de un cliente
   * POST /api/empresa/leer-qr
   */
  async leerQR(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          mensaje: 'El token del QR es requerido'
        });
      }

      // Validar el QR usando el servicio
      const resultado = await qrService.validarQR(token);

      if (!resultado.valido) {
        return res.status(400).json({
          success: false,
          mensaje: resultado.mensaje,
          codigo: resultado.codigo
        });
      }

      res.status(200).json({
        success: true,
        mensaje: 'Código QR válido',
        data: {
          cliente: resultado.cliente,
          token: resultado.token
        }
      });

    } catch (error) {
      console.error('Error al leer QR:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error al procesar código QR'
      });
    }
  }

  /**
   * Agregar puntos a un cliente después de validar QR
   * POST /api/empresa/agregar-puntos
   */
  async agregarPuntos(req, res) {
    try {
      const { token, monto } = req.body;
      const empresa = req.usuario;
      const empresaId = req.usuario._id;

      // ===== VALIDACIONES =====
      if (!token || monto === undefined) {
        return res.status(400).json({
          success: false,
          mensaje: 'Token y monto son requeridos'
        });
      }

      const montoNumerico = parseFloat(monto);
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        return res.status(400).json({
          success: false,
          mensaje: 'El monto debe ser un número mayor a 0'
        });
      }

      // Validar QR usando el servicio
      const resultadoQR = await qrService.validarQR(token);

      if (!resultadoQR.valido) {
        return res.status(400).json({
          success: false,
          mensaje: resultadoQR.mensaje,
          codigo: resultadoQR.codigo
        });
      }

      // ===== CALCULAR PUNTOS =====
      const { gastoRequerido, puntosOtorgados } = empresa.configuracionPuntos || { 
        gastoRequerido: 100, 
        puntosOtorgados: 1 
      };
      
      const puntosCalculados = Math.floor(montoNumerico / gastoRequerido) * puntosOtorgados;

      // Obtener cliente actualizado
      const cliente = await Usuario.findById(resultadoQR.cliente.id);
      const puntosAnteriores = cliente.puntos;

      // ===== ACTUALIZAR PUNTOS TOTALES =====
      cliente.puntos += puntosCalculados;

      // ===== ACTUALIZAR PUNTOS POR EMPRESA =====
      // Inicializar array si no existe
      if (!cliente.puntosPorEmpresa) {
        cliente.puntosPorEmpresa = [];
      }

      const indexEmpresa = cliente.puntosPorEmpresa.findIndex(
        pe => pe.empresa && pe.empresa.toString() === empresaId.toString()
      );

      if (indexEmpresa >= 0) {
        // Ya existe, actualizar puntos de esta empresa
        cliente.puntosPorEmpresa[indexEmpresa].puntos += puntosCalculados;
        cliente.puntosPorEmpresa[indexEmpresa].ultimaTransaccion = new Date();
      } else {
        // Primera vez con esta empresa
        cliente.puntosPorEmpresa.push({
          empresa: empresaId,
          puntos: puntosCalculados,
          ultimaTransaccion: new Date()
        });
      }

      await cliente.save();

      // ===== ACTUALIZAR ESTADÍSTICAS DE LA EMPRESA =====
      await Usuario.findByIdAndUpdate(empresaId, {
        $inc: {
          totalTransacciones: 1,
          totalIngresos: montoNumerico
        }
      });

      // ===== CREAR REGISTRO DE TRANSACCIÓN =====
      const transaccion = new Transaccion({
        cliente: cliente._id,
        empresa: empresaId,
        monto: montoNumerico,
        puntosOtorgados: puntosCalculados,
        puntosAnteriores,
        puntosNuevos: cliente.puntos,
        qrToken: token
      });
      await transaccion.save();

      // Marcar QR como usado
      await qrService.marcarComoUsado(token, empresaId);

      // ===== NOTIFICAR AL CLIENTE =====
      await notificacionService.notificarPuntosAgregados(cliente._id, {
        puntosOtorgados: puntosCalculados,
        puntosAnteriores,
        puntosNuevos: cliente.puntos,
        nombreEmpresa: empresa.nombreEmpresa,
        monto: montoNumerico
      });

      res.status(200).json({
        success: true,
        mensaje: '¡Puntos agregados exitosamente!',
        data: {
          cliente: {
            id: cliente._id,
            nombre: cliente.nombre,
            puntosAnteriores,
            puntosOtorgados: puntosCalculados,
            puntosNuevos: cliente.puntos
          },
          transaccion: {
            id: transaccion._id,
            monto: montoNumerico,
            fecha: transaccion.createdAt
          },
          configuracion: {
            gastoRequerido,
            puntosOtorgados,
            explicacion: `Por cada $${gastoRequerido} MXN = ${puntosOtorgados} punto(s)`
          }
        }
      });

    } catch (error) {
      console.error('Error al agregar puntos:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error al agregar puntos'
      });
    }
  }

  /**
   * Configurar relación de puntos de la empresa
   * PUT /api/empresa/configurar-puntos
   */
  async configurarPuntos(req, res) {
    try {
      const { gastoRequerido, puntosOtorgados } = req.body;

      // Validaciones
      if (gastoRequerido === undefined || puntosOtorgados === undefined) {
        return res.status(400).json({
          success: false,
          mensaje: 'Se requieren gastoRequerido y puntosOtorgados',
          ejemplo: {
            gastoRequerido: 100,
            puntosOtorgados: 1,
            explicacion: 'Por cada $100 MXN gastados, el cliente recibe 1 punto'
          }
        });
      }

      const gastoNum = parseFloat(gastoRequerido);
      const puntosNum = parseInt(puntosOtorgados);

      if (isNaN(gastoNum) || gastoNum < 1) {
        return res.status(400).json({
          success: false,
          mensaje: 'gastoRequerido debe ser un número mayor o igual a 1'
        });
      }

      if (isNaN(puntosNum) || puntosNum < 1) {
        return res.status(400).json({
          success: false,
          mensaje: 'puntosOtorgados debe ser un número entero mayor o igual a 1'
        });
      }

      // Actualizar configuración
      const empresa = await Usuario.findByIdAndUpdate(
        req.usuario._id,
        {
          configuracionPuntos: {
            gastoRequerido: gastoNum,
            puntosOtorgados: puntosNum
          }
        },
        { new: true }
      );

      res.status(200).json({
        success: true,
        mensaje: 'Configuración de puntos actualizada',
        data: {
          configuracionPuntos: empresa.configuracionPuntos,
          explicacion: `Por cada $${gastoNum} MXN gastados = ${puntosNum} punto(s)`,
          ejemplos: [
            { gasto: gastoNum, puntos: puntosNum },
            { gasto: gastoNum * 2, puntos: puntosNum * 2 },
            { gasto: gastoNum * 5, puntos: puntosNum * 5 },
            { gasto: gastoNum * 10, puntos: puntosNum * 10 }
          ]
        }
      });

    } catch (error) {
      console.error('Error al configurar puntos:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener configuración actual de puntos
   * GET /api/empresa/configuracion-puntos
   */
  async obtenerConfiguracionPuntos(req, res) {
    try {
      const empresa = await Usuario.findById(req.usuario._id);
      
      const config = empresa.configuracionPuntos || {
        gastoRequerido: 100,
        puntosOtorgados: 1
      };

      res.status(200).json({
        success: true,
        data: {
          configuracionPuntos: config,
          explicacion: `Por cada $${config.gastoRequerido} MXN gastados = ${config.puntosOtorgados} punto(s)`,
          ejemplos: [
            { gasto: 50, puntos: Math.floor(50 / config.gastoRequerido) * config.puntosOtorgados },
            { gasto: 100, puntos: Math.floor(100 / config.gastoRequerido) * config.puntosOtorgados },
            { gasto: 250, puntos: Math.floor(250 / config.gastoRequerido) * config.puntosOtorgados },
            { gasto: 500, puntos: Math.floor(500 / config.gastoRequerido) * config.puntosOtorgados },
            { gasto: 1000, puntos: Math.floor(1000 / config.gastoRequerido) * config.puntosOtorgados }
          ]
        }
      });

    } catch (error) {
      console.error('Error al obtener configuración:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener resumen de la empresa (dashboard)
   * GET /api/empresa/resumen
   */
  async obtenerResumen(req, res) {
    try {
      const empresa = await Usuario.findById(req.usuario._id);

      // Estadísticas del día
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const statsHoy = await Transaccion.aggregate([
        {
          $match: {
            empresa: empresa._id,
            createdAt: { $gte: hoy }
          }
        },
        {
          $group: {
            _id: null,
            ingresosHoy: { $sum: '$monto' },
            transaccionesHoy: { $sum: 1 },
            puntosOtorgadosHoy: { $sum: '$puntosOtorgados' }
          }
        }
      ]);

      // Últimas 10 transacciones
      const ultimasTransacciones = await Transaccion.find({ 
        empresa: empresa._id 
      })
        .populate('cliente', 'nombre email')
        .sort({ createdAt: -1 })
        .limit(10);

      // Canjes pendientes de entregar
      const canjesPendientes = await Canje.countDocuments({
        empresa: empresa._id,
        estado: 'pendiente'
      });

      res.status(200).json({
        success: true,
        data: {
          empresa: {
            id: empresa._id,
            nombre: empresa.nombreEmpresa,
            totalTransacciones: empresa.totalTransacciones,
            totalIngresos: empresa.totalIngresos,
            configuracionPuntos: empresa.configuracionPuntos || {
              gastoRequerido: 100,
              puntosOtorgados: 1
            }
          },
          hoy: statsHoy[0] || {
            ingresosHoy: 0,
            transaccionesHoy: 0,
            puntosOtorgadosHoy: 0
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
   * Obtener historial de transacciones de la empresa
   * GET /api/empresa/historial
   */
  async obtenerHistorial(req, res) {
    try {
      const { page = 1, limit = 20, desde, hasta } = req.query;
      const skip = (page - 1) * limit;

      // Filtro base
      const filtro = { empresa: req.usuario._id };

      // Filtro por fechas
      if (desde || hasta) {
        filtro.createdAt = {};
        if (desde) filtro.createdAt.$gte = new Date(desde);
        if (hasta) filtro.createdAt.$lte = new Date(hasta);
      }

      const [transacciones, total] = await Promise.all([
        Transaccion.find(filtro)
          .populate('cliente', 'nombre email telefono')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Transaccion.countDocuments(filtro)
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
}

module.exports = new EmpresaController();