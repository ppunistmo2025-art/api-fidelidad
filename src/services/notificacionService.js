/**
 * =====================================================
 * SERVICIO DE NOTIFICACIONES - WebSocket
 * =====================================================
 * Archivo: src/services/notificacionService.js
 * Descripción: Notificaciones en tiempo real usando Socket.io
 *              Permite enviar mensajes instantáneos a los usuarios
 * =====================================================
 */

const Usuario = require('../models/Usuario');

class NotificacionService {
  constructor() {
    this.io = null;
  }

  /**
   * Inicializar con la instancia de Socket.io
   * @param {Object} io - Instancia de Socket.io
   */
  init(io) {
    this.io = io;
    this.configurarEventos();
    console.log('✅ Servicio de notificaciones WebSocket inicializado');
  }

  /**
   * Configurar eventos de conexión
   */
  configurarEventos() {
    this.io.on('connection', async (socket) => {
      console.log(`📱 Cliente conectado: ${socket.id}`);

      // ===== EVENTO: Usuario se registra con su ID =====
      socket.on('registrar_usuario', async (usuarioId) => {
        try {
          // Actualizar socketId en la base de datos
          await Usuario.findByIdAndUpdate(usuarioId, { 
            socketId: socket.id 
          });
          
          // Guardar referencia en el socket
          socket.usuarioId = usuarioId;
          
          console.log(`👤 Usuario ${usuarioId} registrado con socket ${socket.id}`);
          
          // Confirmar registro
          socket.emit('registro_exitoso', {
            mensaje: 'Conectado para recibir notificaciones en tiempo real',
            socketId: socket.id
          });
        } catch (error) {
          console.error('Error al registrar usuario:', error.message);
          socket.emit('error', { mensaje: 'Error al registrar' });
        }
      });

      // ===== EVENTO: Ping para mantener conexión =====
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // ===== EVENTO: Desconexión =====
      socket.on('disconnect', async () => {
        console.log(`📴 Cliente desconectado: ${socket.id}`);
        
        // Limpiar socketId de la base de datos
        if (socket.usuarioId) {
          try {
            await Usuario.findByIdAndUpdate(socket.usuarioId, { 
              socketId: null 
            });
          } catch (error) {
            console.error('Error al limpiar socketId:', error.message);
          }
        }
      });
    });
  }

  /**
   * Enviar notificación de puntos agregados al cliente
   * @param {String} clienteId - ID del cliente
   * @param {Object} datos - Datos de la transacción
   */
  async notificarPuntosAgregados(clienteId, datos) {
    try {
      const cliente = await Usuario.findById(clienteId);
      
      if (cliente && cliente.socketId) {
        this.io.to(cliente.socketId).emit('puntos_agregados', {
          tipo: 'PUNTOS_AGREGADOS',
          mensaje: '¡Felicidades! Puntos agregados con éxito',
          datos: {
            puntosAgregados: datos.puntosOtorgados,
            puntosAnteriores: datos.puntosAnteriores,
            puntosNuevos: datos.puntosNuevos,
            empresa: datos.nombreEmpresa,
            monto: datos.monto,
            fecha: new Date().toISOString()
          }
        });
        
        console.log(`🔔 Notificación enviada a cliente ${clienteId}`);
        return true;
      } else {
        console.log(`⚠️  Cliente ${clienteId} no tiene socket activo`);
        return false;
      }
    } catch (error) {
      console.error('Error al enviar notificación:', error.message);
      return false;
    }
  }

  /**
   * Notificar nuevo canje a la empresa
   * @param {String} empresaId - ID de la empresa
   * @param {Object} datos - Datos del canje
   */
  async notificarNuevoCanje(empresaId, datos) {
    try {
      const empresa = await Usuario.findById(empresaId);
      
      if (empresa && empresa.socketId) {
        this.io.to(empresa.socketId).emit('nuevo_canje', {
          tipo: 'NUEVO_CANJE',
          mensaje: `${datos.clienteNombre} canjeó: ${datos.recompensaNombre}`,
          datos: {
            codigoCanje: datos.codigoCanje,
            cliente: datos.clienteNombre,
            recompensa: datos.recompensaNombre,
            fecha: new Date().toISOString()
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al notificar canje:', error.message);
      return false;
    }
  }

  /**
   * Notificar canje entregado al cliente
   * @param {String} clienteId - ID del cliente
   * @param {Object} datos - Datos del canje
   */
  async notificarCanjeEntregado(clienteId, datos) {
    try {
      const cliente = await Usuario.findById(clienteId);
      
      if (cliente && cliente.socketId) {
        this.io.to(cliente.socketId).emit('canje_entregado', {
          tipo: 'CANJE_ENTREGADO',
          mensaje: '¡Tu recompensa ha sido entregada!',
          datos: {
            recompensa: datos.recompensaNombre,
            codigoCanje: datos.codigoCanje,
            fecha: new Date().toISOString()
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al notificar entrega:', error.message);
      return false;
    }
  }

  /**
   * Notificar canje cancelado al cliente
   * @param {String} clienteId - ID del cliente
   * @param {Object} datos - Datos del canje
   */
  async notificarCanjeCancelado(clienteId, datos) {
    try {
      const cliente = await Usuario.findById(clienteId);
      
      if (cliente && cliente.socketId) {
        this.io.to(cliente.socketId).emit('canje_cancelado', {
          tipo: 'CANJE_CANCELADO',
          mensaje: 'Tu canje ha sido cancelado. Los puntos fueron devueltos.',
          datos: {
            puntosDevueltos: datos.puntosDevueltos,
            recompensa: datos.recompensaNombre,
            fecha: new Date().toISOString()
          }
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al notificar cancelación:', error.message);
      return false;
    }
  }

  /**
   * Enviar notificación genérica a un usuario
   * @param {String} usuarioId - ID del usuario
   * @param {String} evento - Nombre del evento
   * @param {Object} datos - Datos a enviar
   */
  async enviarNotificacion(usuarioId, evento, datos) {
    try {
      const usuario = await Usuario.findById(usuarioId);
      
      if (usuario && usuario.socketId) {
        this.io.to(usuario.socketId).emit(evento, datos);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al enviar notificación:', error.message);
      return false;
    }
  }

  /**
   * Broadcast a todos los usuarios conectados
   * @param {String} evento - Nombre del evento
   * @param {Object} datos - Datos a enviar
   */
  broadcast(evento, datos) {
    if (this.io) {
      this.io.emit(evento, datos);
    }
  }
}

module.exports = new NotificacionService();