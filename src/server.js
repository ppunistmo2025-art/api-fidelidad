/**
 * =====================================================
 * SERVIDOR PRINCIPAL - Fidelidad Amigo
 * =====================================================
 * Archivo: src/server.js
 * Descripción: Entry point de la aplicación
 *              - Configura Express
 *              - Configura Socket.io para WebSocket
 *              - Conecta a MongoDB Atlas
 * =====================================================
 */

// Cargar variables de entorno
require('dotenv').config();

// Dependencias
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Módulos propios
const { conectarDB } = require('./config/database');
const routes = require('./routes');
const notificacionService = require('./services/notificacionService');

// ===== CREAR APLICACIÓN EXPRESS =====
const app = express();

// Crear servidor HTTP (necesario para Socket.io)
const server = http.createServer(app);

// ===== CONFIGURAR SOCKET.IO =====
const io = new Server(server, {
  cors: {
    origin: '*', // En producción, especificar dominios permitidos
    methods: ['GET', 'POST']
  }
});

// Inicializar servicio de notificaciones con Socket.io
notificacionService.init(io);

// Puerto
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// ===== MIDDLEWARES =====

// CORS - Permitir peticiones de otros dominios
app.use(cors());

// Parsear JSON en el body
app.use(express.json({ limit: '10mb' }));

// Parsear datos de formularios
app.use(express.urlencoded({ extended: true }));

// Log de peticiones (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// ===== RUTAS DE LA API =====
app.use('/api', routes);

// ===== RUTA DE HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    app: 'Fidelidad Amigo API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ===== RUTA RAÍZ - DOCUMENTACIÓN =====
app.get('/', (req, res) => {
  res.json({
    app: '🎯 Fidelidad Amigo API',
    version: '1.0.0',
    descripcion: 'Sistema de fidelidad con QR para clientes y empresas',
    documentacion: {
      autenticacion: {
        registro: 'POST /api/auth/registro',
        login: 'POST /api/auth/login',
        perfil: 'GET /api/auth/perfil',
        actualizarPerfil: 'PUT /api/auth/perfil',
        cambiarPassword: 'PUT /api/auth/cambiar-password'
      },
      cliente: {
        generarQR: 'POST /api/cliente/generar-qr',
        verPuntos: 'GET /api/cliente/puntos',
        historial: 'GET /api/cliente/historial',
        resumen: 'GET /api/cliente/resumen'
      },
      empresa: {
        leerQR: 'POST /api/empresa/leer-qr',
        agregarPuntos: 'POST /api/empresa/agregar-puntos',
        resumen: 'GET /api/empresa/resumen',
        historial: 'GET /api/empresa/historial'
      },
      recompensas: {
        listar: 'GET /api/recompensas',
        misRecompensas: 'GET /api/recompensas/mis-recompensas',
        detalle: 'GET /api/recompensas/:id',
        crear: 'POST /api/recompensas',
        actualizar: 'PUT /api/recompensas/:id',
        eliminar: 'DELETE /api/recompensas/:id'
      },
      canjes: {
        canjear: 'POST /api/canjes',
        misCanjes: 'GET /api/canjes/mis-canjes',
        canjesEmpresa: 'GET /api/canjes/empresa',
        validarCodigo: 'GET /api/canjes/validar/:codigo',
        marcarEntregado: 'PUT /api/canjes/:id/entregar',
        cancelar: 'PUT /api/canjes/:id/cancelar'
      }
    },
    websocket: {
      url: APP_URL.replace('http', 'ws'),
      eventos: {
        cliente: ['puntos_agregados', 'canje_entregado', 'canje_cancelado'],
        empresa: ['nuevo_canje']
      }
    }
  });
});

// ===== MANEJO DE RUTA NO ENCONTRADA =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    mensaje: 'Ruta no encontrada',
    ruta: req.originalUrl
  });
});

// ===== MANEJO DE ERRORES GLOBAL =====
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    success: false,
    mensaje: 'Error interno del servidor'
  });
});

// ===== INICIAR SERVIDOR =====
const iniciarServidor = async () => {
  try {
    // Conectar a MongoDB Atlas
    await conectarDB();

    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🎯  FIDELIDAD AMIGO - Backend API                                  ║
║                                                                      ║
║   🚀  Servidor corriendo en: ${APP_URL}                   ║
║   📡  WebSocket activo en:   ${APP_URL.replace('http', 'ws')}                     ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║   📱 ENDPOINTS CLIENTE:                                              ║
║   ├── POST /api/auth/registro        → Registro                      ║
║   ├── POST /api/auth/login           → Login                         ║
║   ├── POST /api/cliente/generar-qr   → Generar QR (30 seg)           ║
║   ├── GET  /api/cliente/puntos       → Ver puntos                    ║
║   ├── GET  /api/cliente/resumen      → Dashboard                     ║
║   └── POST /api/canjes               → Canjear puntos                ║
║                                                                      ║
║   🏪 ENDPOINTS EMPRESA:                                              ║
║   ├── POST /api/empresa/leer-qr        → Validar QR                  ║
║   ├── POST /api/empresa/agregar-puntos → Agregar puntos              ║
║   ├── GET  /api/empresa/resumen        → Dashboard                   ║
║   ├── POST /api/recompensas            → Crear recompensa            ║
║   ├── GET  /api/canjes/validar/:cod    → Validar código canje        ║
║   └── PUT  /api/canjes/:id/entregar    → Marcar entregado            ║
║                                                                      ║
║   🔔 WebSocket para notificaciones en tiempo real                    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// ===== MANEJO DE SEÑALES DE TERMINACIÓN =====
process.on('SIGINT', () => {
  console.log('\n⏹️  Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Manejar errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});

// ===== INICIAR =====
iniciarServidor();

// Exportar para testing
module.exports = { app, server, io };