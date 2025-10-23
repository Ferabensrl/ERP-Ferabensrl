/**
 * ============================================
 * SERVICIO DE NOTIFICACIONES - ERP FERABEN
 * ============================================
 * Gestiona notificaciones del navegador para nuevos pedidos
 */

// ============================================
// TIPOS
// ============================================

export interface OpcionesNotificacion {
  titulo: string;
  cuerpo: string;
  icono?: string;
  badge?: string;
  tag?: string;
  silent?: boolean;
}

// ============================================
// GESTIÓN DE PERMISOS
// ============================================

/**
 * Solicitar permiso para mostrar notificaciones
 * @returns true si el permiso fue otorgado, false en caso contrario
 */
export const solicitarPermisoNotificaciones = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('⚠️ Este navegador no soporta notificaciones de escritorio');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('✅ Permiso para notificaciones ya otorgado');
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('❌ Permiso para notificaciones denegado');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log(`🔔 Permiso de notificaciones: ${permission}`);
    return permission === 'granted';
  } catch (error) {
    console.error('❌ Error solicitando permiso de notificaciones:', error);
    return false;
  }
};

/**
 * Verificar si las notificaciones están habilitadas
 * @returns true si están habilitadas, false en caso contrario
 */
export const notificacionesHabilitadas = (): boolean => {
  return 'Notification' in window && Notification.permission === 'granted';
};

// ============================================
// MOSTRAR NOTIFICACIONES
// ============================================

/**
 * Mostrar notificación del navegador
 * @param opciones - Opciones de la notificación
 * @returns Objeto Notification o null si no se pudo mostrar
 */
export const mostrarNotificacion = (opciones: OpcionesNotificacion): Notification | null => {
  if (!notificacionesHabilitadas()) {
    console.warn('⚠️ Las notificaciones no están habilitadas');
    return null;
  }

  try {
    const notificacion = new Notification(opciones.titulo, {
      body: opciones.cuerpo,
      icon: opciones.icono || '/favicon.ico',
      badge: opciones.badge || '/favicon.ico',
      tag: opciones.tag || 'erp-feraben',
      silent: opciones.silent || false,
      requireInteraction: true, // La notificación permanece hasta que el usuario la cierre
    });

    // Reproducir sonido si no es silenciosa
    if (!opciones.silent) {
      reproducirSonidoNotificacion();
    }

    // Click en la notificación: enfocar la ventana
    notificacion.onclick = () => {
      window.focus();
      notificacion.close();
    };

    console.log('🔔 Notificación mostrada:', opciones.titulo);
    return notificacion;

  } catch (error) {
    console.error('❌ Error mostrando notificación:', error);
    return null;
  }
};

/**
 * Mostrar notificación de nuevo pedido recibido
 * @param numeroPedido - Número del pedido
 * @param clienteNombre - Nombre del cliente
 * @param totalPedido - Total del pedido
 */
export const notificarNuevoPedido = (
  numeroPedido: string,
  clienteNombre: string,
  totalPedido: number
): void => {
  mostrarNotificacion({
    titulo: '🛒 Nuevo Pedido Recibido',
    cuerpo: `${numeroPedido} - ${clienteNombre}\nTotal: $${totalPedido.toLocaleString('es-AR')}`,
    tag: `pedido-${numeroPedido}`,
    silent: false
  });
};

/**
 * Mostrar notificación de múltiples pedidos recibidos
 * @param cantidad - Cantidad de pedidos nuevos
 */
export const notificarMultiplesPedidos = (cantidad: number): void => {
  mostrarNotificacion({
    titulo: '🛒 Nuevos Pedidos Recibidos',
    cuerpo: `Tienes ${cantidad} pedidos nuevos pendientes de revisar`,
    tag: 'pedidos-multiples',
    silent: false
  });
};

// ============================================
// SONIDO DE NOTIFICACIÓN
// ============================================

/**
 * Reproducir sonido de notificación
 */
const reproducirSonidoNotificacion = (): void => {
  try {
    // Crear un AudioContext para generar un sonido
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Sonido simple: dos beeps
    const reproducirBeep = (frecuencia: number, duracion: number, delay: number = 0) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frecuencia;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracion);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duracion);
      }, delay);
    };

    // Dos beeps: más grave y más agudo
    reproducirBeep(600, 0.15, 0);
    reproducirBeep(800, 0.15, 200);

  } catch (error) {
    console.warn('⚠️ No se pudo reproducir el sonido de notificación:', error);
  }
};

// ============================================
// BADGE EN TÍTULO DE LA PÁGINA
// ============================================

let tituloOriginal: string = document.title;
let contadorPedidos: number = 0;
let intervaloBadge: NodeJS.Timeout | null = null;

/**
 * Actualizar badge en el título de la página
 * @param cantidad - Cantidad de pedidos pendientes
 */
export const actualizarBadgeTitulo = (cantidad: number): void => {
  contadorPedidos = cantidad;

  if (cantidad > 0) {
    // Iniciar parpadeo del título
    if (!intervaloBadge) {
      let mostrarBadge = true;
      intervaloBadge = setInterval(() => {
        if (mostrarBadge) {
          document.title = `(${contadorPedidos}) ${tituloOriginal}`;
        } else {
          document.title = tituloOriginal;
        }
        mostrarBadge = !mostrarBadge;
      }, 1000);
    }

    document.title = `(${cantidad}) ${tituloOriginal}`;
  } else {
    // Detener parpadeo y restaurar título original
    if (intervaloBadge) {
      clearInterval(intervaloBadge);
      intervaloBadge = null;
    }
    document.title = tituloOriginal;
  }
};

/**
 * Restaurar título original de la página
 */
export const restaurarTitulo = (): void => {
  if (intervaloBadge) {
    clearInterval(intervaloBadge);
    intervaloBadge = null;
  }
  document.title = tituloOriginal;
  contadorPedidos = 0;
};

/**
 * Establecer el título original (llamar al iniciar la app)
 * @param titulo - Título original de la página
 */
export const setTituloOriginal = (titulo: string): void => {
  tituloOriginal = titulo;
};

// ============================================
// EXPORT DEFAULT
// ============================================
export default {
  solicitarPermisoNotificaciones,
  notificacionesHabilitadas,
  mostrarNotificacion,
  notificarNuevoPedido,
  notificarMultiplesPedidos,
  actualizarBadgeTitulo,
  restaurarTitulo,
  setTituloOriginal
};
