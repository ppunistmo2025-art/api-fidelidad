/**
 * =====================================================
 * RUTAS DE LA API
 * =====================================================
 * Archivo: src/routes/index.js
 * Descripción: Definición de todos los endpoints
 * =====================================================
 */

const express = require('express');
const router = express.Router();

// ===== CONTROLADORES =====
const authController = require('../controllers/authController');
const clienteController = require('../controllers/clienteController');
const empresaController = require('../controllers/empresaController');
const recompensaController = require('../controllers/recompensaController');
const canjeController = require('../controllers/canjeController');

// ===== MIDDLEWARE =====
const { verificarToken, restringirA } = require('../middleware/auth');


// ╔══════════════════════════════════════════════════════════════╗
// ║                 RUTAS DE AUTENTICACIÓN                       ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * @route   POST /api/auth/registro
 * @desc    Registrar nuevo usuario (cliente o empresa)
 * @access  Público
 */
router.post('/auth/registro', authController.registro);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Público
 */
router.post('/auth/login', authController.login);

/**
 * @route   GET /api/auth/perfil
 * @desc    Obtener perfil del usuario autenticado
 * @access  Privado
 */
router.get('/auth/perfil', verificarToken, authController.obtenerPerfil);

/**
 * @route   PUT /api/auth/perfil
 * @desc    Actualizar perfil
 * @access  Privado
 */
router.put('/auth/perfil', verificarToken, authController.actualizarPerfil);

/**
 * @route   PUT /api/auth/cambiar-password
 * @desc    Cambiar contraseña
 * @access  Privado
 */
router.put('/auth/cambiar-password', verificarToken, authController.cambiarPassword);


// ╔══════════════════════════════════════════════════════════════╗
// ║                    RUTAS DE CLIENTE                          ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * @route   POST /api/cliente/generar-qr
 * @desc    Generar código QR (expira en 30 segundos)
 * @access  Solo clientes
 */
router.post(
  '/cliente/generar-qr',
  verificarToken,
  restringirA('cliente'),
  clienteController.generarQR
);

/**
 * @route   GET /api/cliente/puntos
 * @desc    Obtener puntos actuales
 * @access  Solo clientes
 */
router.get(
  '/cliente/puntos',
  verificarToken,
  restringirA('cliente'),
  clienteController.obtenerPuntos
);

/**
 * @route   GET /api/cliente/puntos-empresas
 * @desc    Obtener puntos desglosados por empresa
 * @access  Solo clientes
 */
router.get(
  '/cliente/puntos-empresas',
  verificarToken,
  restringirA('cliente'),
  clienteController.obtenerPuntosEmpresas
);

/**
 * @route   GET /api/cliente/historial
 * @desc    Obtener historial de transacciones
 * @access  Solo clientes
 */
router.get(
  '/cliente/historial',
  verificarToken,
  restringirA('cliente'),
  clienteController.obtenerHistorial
);

/**
 * @route   GET /api/cliente/resumen
 * @desc    Obtener resumen/dashboard del cliente
 * @access  Solo clientes
 */
router.get(
  '/cliente/resumen',
  verificarToken,
  restringirA('cliente'),
  clienteController.obtenerResumen
);


// ╔══════════════════════════════════════════════════════════════╗
// ║                    RUTAS DE EMPRESA                          ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * @route   PUT /api/empresa/configurar-puntos
 * @desc    Configurar relación gasto/puntos de la empresa
 * @access  Solo empresas
 */
router.put(
  '/empresa/configurar-puntos',
  verificarToken,
  restringirA('empresa'),
  empresaController.configurarPuntos
);

/**
 * @route   GET /api/empresa/configuracion-puntos
 * @desc    Obtener configuración actual de puntos
 * @access  Solo empresas
 */
router.get(
  '/empresa/configuracion-puntos',
  verificarToken,
  restringirA('empresa'),
  empresaController.obtenerConfiguracionPuntos
);

/**
 * @route   POST /api/empresa/leer-qr
 * @desc    Validar/Leer código QR de un cliente
 * @access  Solo empresas
 */
router.post(
  '/empresa/leer-qr',
  verificarToken,
  restringirA('empresa'),
  empresaController.leerQR
);

/**
 * @route   POST /api/empresa/agregar-puntos
 * @desc    Agregar puntos a un cliente
 * @access  Solo empresas
 */
router.post(
  '/empresa/agregar-puntos',
  verificarToken,
  restringirA('empresa'),
  empresaController.agregarPuntos
);

/**
 * @route   GET /api/empresa/resumen
 * @desc    Obtener resumen/dashboard de la empresa
 * @access  Solo empresas
 */
router.get(
  '/empresa/resumen',
  verificarToken,
  restringirA('empresa'),
  empresaController.obtenerResumen
);

/**
 * @route   GET /api/empresa/historial
 * @desc    Obtener historial de transacciones
 * @access  Solo empresas
 */
router.get(
  '/empresa/historial',
  verificarToken,
  restringirA('empresa'),
  empresaController.obtenerHistorial
);


// ╔══════════════════════════════════════════════════════════════╗
// ║                   RUTAS DE RECOMPENSAS                       ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * @route   GET /api/recompensas
 * @desc    Listar recompensas disponibles (para clientes)
 * @access  Privado
 */
router.get(
  '/recompensas',
  verificarToken,
  recompensaController.listarDisponibles
);

/**
 * @route   GET /api/recompensas/mis-recompensas
 * @desc    Listar recompensas de la empresa autenticada
 * @access  Solo empresas
 */
router.get(
  '/recompensas/mis-recompensas',
  verificarToken,
  restringirA('empresa'),
  recompensaController.listarPropias
);

/**
 * @route   GET /api/recompensas/:id
 * @desc    Obtener detalle de una recompensa
 * @access  Privado
 */
router.get(
  '/recompensas/:id',
  verificarToken,
  recompensaController.obtenerPorId
);

/**
 * @route   POST /api/recompensas
 * @desc    Crear nueva recompensa
 * @access  Solo empresas
 */
router.post(
  '/recompensas',
  verificarToken,
  restringirA('empresa'),
  recompensaController.crear
);

/**
 * @route   PUT /api/recompensas/:id
 * @desc    Actualizar recompensa
 * @access  Solo empresa dueña
 */
router.put(
  '/recompensas/:id',
  verificarToken,
  restringirA('empresa'),
  recompensaController.actualizar
);

/**
 * @route   DELETE /api/recompensas/:id
 * @desc    Eliminar recompensa
 * @access  Solo empresa dueña
 */
router.delete(
  '/recompensas/:id',
  verificarToken,
  restringirA('empresa'),
  recompensaController.eliminar
);


// ╔══════════════════════════════════════════════════════════════╗
// ║                     RUTAS DE CANJES                          ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * @route   POST /api/canjes
 * @desc    Canjear puntos por una recompensa
 * @access  Solo clientes
 */
router.post(
  '/canjes',
  verificarToken,
  restringirA('cliente'),
  canjeController.canjear
);

/**
 * @route   GET /api/canjes/mis-canjes
 * @desc    Listar canjes del cliente
 * @access  Solo clientes
 */
router.get(
  '/canjes/mis-canjes',
  verificarToken,
  restringirA('cliente'),
  canjeController.listarCanjesCliente
);

/**
 * @route   GET /api/canjes/empresa
 * @desc    Listar canjes de la empresa (pendientes de entregar)
 * @access  Solo empresas
 */
router.get(
  '/canjes/empresa',
  verificarToken,
  restringirA('empresa'),
  canjeController.listarCanjesEmpresa
);

/**
 * @route   GET /api/canjes/validar/:codigo
 * @desc    Validar código de canje
 * @access  Solo empresas
 */
router.get(
  '/canjes/validar/:codigo',
  verificarToken,
  restringirA('empresa'),
  canjeController.validarCodigo
);

/**
 * @route   PUT /api/canjes/:id/entregar
 * @desc    Marcar canje como entregado
 * @access  Solo empresas
 */
router.put(
  '/canjes/:id/entregar',
  verificarToken,
  restringirA('empresa'),
  canjeController.marcarEntregado
);

/**
 * @route   PUT /api/canjes/:id/cancelar
 * @desc    Cancelar canje (devuelve puntos al cliente)
 * @access  Solo empresas
 */
router.put(
  '/canjes/:id/cancelar',
  verificarToken,
  restringirA('empresa'),
  canjeController.cancelar
);


module.exports = router;