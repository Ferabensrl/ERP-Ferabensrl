import React, { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  ArrowLeft,
  Eye,
  User,
  Trash2,
  Edit3,
  Search,
  AlertCircle,
  Download,
  Upload,
  Bell,
  BellOff
} from 'lucide-react';
import styles from './PedidosRecibidos.module.css';
import { supabase, pedidosRecibidosService, type PedidoRecibido, type PedidoRecibidoProducto } from '../../lib/supabaseClient';
import { generarComprobantePDF, descargarPDF } from '../../lib/pdfGenerator';
import notificacionesService from '../../lib/notificacionesService';

// ============================================
// TIPOS Y INTERFACES
// ============================================

interface PedidosRecibidosProps {
  onVolverDashboard?: () => void;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const PedidosRecibidos: React.FC<PedidosRecibidosProps> = ({ onVolverDashboard }) => {
  const [pedidos, setPedidos] = useState<PedidoRecibido[]>([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoRecibido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoEditando, setProductoEditando] = useState<PedidoRecibidoProducto | null>(null);
  const [notificacionesActivas, setNotificacionesActivas] = useState(false);
  const [cantidadPedidosAnterior, setCantidadPedidosAnterior] = useState(0);

  // ============================================
  // CARGAR PEDIDOS DESDE SUPABASE
  // ============================================

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('pedidos_recibidos')
        .select('*')
        .eq('estado', 'recibido')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPedidos(data || []);
    } catch (err) {
      console.error('Error cargando pedidos recibidos:', err);
      setError('Error al cargar pedidos recibidos. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // INICIALIZACIÓN Y NOTIFICACIONES
  // ============================================

  useEffect(() => {
    cargarPedidos();

    // Configurar título original para las notificaciones
    notificacionesService.setTituloOriginal('Pedidos Recibidos - ERP Feraben');

    // Verificar si las notificaciones ya están habilitadas
    const notifHabilitadas = notificacionesService.notificacionesHabilitadas();
    setNotificacionesActivas(notifHabilitadas);

    // Suscripción a cambios en tiempo real
    const subscription = supabase
      .channel('pedidos_recibidos_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos_recibidos' },
        (payload) => {
          console.log('🔄 Cambio detectado en pedidos_recibidos:', payload);
          cargarPedidos(); // Recargar la lista
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      notificacionesService.restaurarTitulo();
    };
  }, []);

  // ============================================
  // EFECTO: Detectar nuevos pedidos y notificar
  // ============================================

  useEffect(() => {
    // Solo notificar si hay más pedidos que antes (y no es la carga inicial)
    if (cantidadPedidosAnterior > 0 && pedidos.length > cantidadPedidosAnterior) {
      const pedidosNuevos = pedidos.length - cantidadPedidosAnterior;

      if (notificacionesActivas) {
        if (pedidosNuevos === 1) {
          // Notificar pedido individual
          const pedidoNuevo = pedidos[0]; // El más reciente
          notificacionesService.notificarNuevoPedido(
            pedidoNuevo.numero,
            pedidoNuevo.cliente_nombre,
            pedidoNuevo.total
          );
        } else {
          // Notificar múltiples pedidos
          notificacionesService.notificarMultiplesPedidos(pedidosNuevos);
        }
      }
    }

    // Actualizar badge en el título
    notificacionesService.actualizarBadgeTitulo(pedidos.length);

    // Actualizar cantidad anterior
    setCantidadPedidosAnterior(pedidos.length);
  }, [pedidos.length, notificacionesActivas]);

  // ============================================
  // GESTIÓN DE NOTIFICACIONES
  // ============================================

  const handleActivarNotificaciones = async () => {
    const permisoConcedido = await notificacionesService.solicitarPermisoNotificaciones();

    if (permisoConcedido) {
      setNotificacionesActivas(true);
      alert('✅ Notificaciones activadas\n\nRecibirás alertas cuando lleguen nuevos pedidos.');
    } else {
      alert(
        '⚠️ No se pudo activar las notificaciones\n\n' +
        'Por favor, permite las notificaciones en la configuración de tu navegador.'
      );
    }
  };

  const handleDesactivarNotificaciones = () => {
    setNotificacionesActivas(false);
    notificacionesService.restaurarTitulo();
    alert('🔕 Notificaciones desactivadas');
  };

  // ============================================
  // FUNCIONES DE NEGOCIO
  // ============================================

  /**
   * Aprobar pedido y moverlo a la tabla principal de pedidos
   */
  const handleAprobarPedido = async (pedido: PedidoRecibido) => {
    const confirmacion = window.confirm(
      `¿Aprobar y enviar a depósito el pedido ${pedido.numero}?\n\n` +
      `Cliente: ${pedido.cliente_nombre}\n` +
      `Productos: ${pedido.productos.length}\n` +
      `Total: $${pedido.total.toLocaleString('es-AR')}\n\n` +
      `El pedido se moverá a la sección de Pedidos para preparación.`
    );

    if (!confirmacion) return;

    try {
      setLoading(true);

      // Llamar a la función de Supabase para aprobar el pedido
      const { data, error } = await supabase
        .rpc('aprobar_pedido_recibido', {
          pedido_recibido_id: pedido.id
        });

      if (error) throw error;

      alert(
        `✅ Pedido ${pedido.numero} aprobado exitosamente\n\n` +
        `El pedido ha sido movido a la sección de Pedidos.\n` +
        `El depósito puede comenzar la preparación.`
      );

      // Recargar la lista de pedidos
      await cargarPedidos();

      // Si estábamos viendo el pedido, volver a la lista
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(null);
      }

    } catch (err) {
      console.error('Error aprobando pedido:', err);
      alert(
        `❌ Error al aprobar el pedido\n\n` +
        `Por favor intenta nuevamente.\n` +
        `Detalle: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rechazar pedido (eliminar de la cola)
   */
  const handleRechazarPedido = async (pedido: PedidoRecibido) => {
    const motivo = window.prompt(
      `¿Por qué rechazas el pedido ${pedido.numero}?\n\n` +
      `Esta acción eliminará el pedido de la cola.`
    );

    if (!motivo || motivo.trim() === '') return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('pedidos_recibidos')
        .delete()
        .eq('id', pedido.id);

      if (error) throw error;

      alert(
        `🗑️ Pedido ${pedido.numero} rechazado\n\n` +
        `Motivo: ${motivo}\n\n` +
        `El pedido ha sido eliminado de la cola.`
      );

      // Recargar la lista de pedidos
      await cargarPedidos();

      // Si estábamos viendo el pedido, volver a la lista
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(null);
      }

    } catch (err) {
      console.error('Error rechazando pedido:', err);
      alert(
        `❌ Error al rechazar el pedido\n\n` +
        `Por favor intenta nuevamente.\n` +
        `Detalle: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Editar cantidad de variante de un producto
   */
  const handleEditarCantidad = (producto: PedidoRecibidoProducto, indexVariante: number, nuevaCantidad: number) => {
    if (!pedidoSeleccionado) return;

    const pedidoActualizado = {
      ...pedidoSeleccionado,
      productos: pedidoSeleccionado.productos.map(p => {
        if (p.codigo === producto.codigo) {
          const variantesActualizadas = [...p.variantes];
          variantesActualizadas[indexVariante] = {
            ...variantesActualizadas[indexVariante],
            cantidad: Math.max(0, nuevaCantidad)
          };
          return { ...p, variantes: variantesActualizadas };
        }
        return p;
      })
    };

    setPedidoSeleccionado(pedidoActualizado);
  };

  /**
   * Eliminar variante de un producto
   */
  const handleEliminarVariante = (producto: PedidoRecibidoProducto, indexVariante: number) => {
    if (!pedidoSeleccionado) return;

    const confirmacion = window.confirm(
      `¿Eliminar la variante "${producto.variantes[indexVariante].color}" del producto ${producto.codigo}?`
    );

    if (!confirmacion) return;

    const pedidoActualizado = {
      ...pedidoSeleccionado,
      productos: pedidoSeleccionado.productos.map(p => {
        if (p.codigo === producto.codigo) {
          const variantesActualizadas = p.variantes.filter((_, i) => i !== indexVariante);
          return { ...p, variantes: variantesActualizadas };
        }
        return p;
      })
    };

    setPedidoSeleccionado(pedidoActualizado);
  };

  /**
   * Eliminar producto completo del pedido
   */
  const handleEliminarProducto = (producto: PedidoRecibidoProducto) => {
    if (!pedidoSeleccionado) return;

    const confirmacion = window.confirm(
      `¿Eliminar completamente el producto ${producto.codigo} - ${producto.nombre}?`
    );

    if (!confirmacion) return;

    const pedidoActualizado = {
      ...pedidoSeleccionado,
      productos: pedidoSeleccionado.productos.filter(p => p.codigo !== producto.codigo)
    };

    setPedidoSeleccionado(pedidoActualizado);
  };

  /**
   * Descargar PDF del pedido
   */
  const handleDescargarPDF = () => {
    if (!pedidoSeleccionado) return;

    try {
      const datosPDF = {
        pedido: pedidoSeleccionado,
        clienteNombre: pedidoSeleccionado.cliente_nombre
      };

      const pdf = generarComprobantePDF(datosPDF);
      descargarPDF(pdf, pedidoSeleccionado.numero);

      console.log('✅ PDF generado y descargado:', pedidoSeleccionado.numero);
    } catch (err) {
      console.error('❌ Error generando PDF:', err);
      alert(
        '❌ Error al generar el PDF\n\n' +
        'Por favor intenta nuevamente.\n' +
        `Detalle: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    }
  };

  /**
   * Guardar cambios del pedido editado
   */
  const handleGuardarCambios = async () => {
    if (!pedidoSeleccionado) return;

    try {
      setLoading(true);

      // Filtrar productos sin variantes
      const productosValidos = pedidoSeleccionado.productos.filter(p =>
        p.variantes.length > 0 && p.variantes.some(v => v.cantidad > 0)
      );

      if (productosValidos.length === 0) {
        alert('⚠️ El pedido no puede quedar sin productos.\n\nAgrega al menos un producto antes de guardar.');
        return;
      }

      // Recalcular total
      const nuevoTotal = productosValidos.reduce((total, producto) => {
        const totalProducto = producto.variantes.reduce((sum, v) => sum + (v.cantidad * producto.precio_unitario), 0);
        return total + totalProducto;
      }, 0);

      const pedidoActualizado = {
        ...pedidoSeleccionado,
        productos: productosValidos,
        total: nuevoTotal
      };

      const { error } = await supabase
        .from('pedidos_recibidos')
        .update({
          productos: pedidoActualizado.productos,
          total: pedidoActualizado.total,
          comentario_final: pedidoActualizado.comentario_final
        })
        .eq('id', pedidoActualizado.id);

      if (error) throw error;

      alert('✅ Cambios guardados exitosamente');

      setPedidoSeleccionado(pedidoActualizado);
      setModoEdicion(false);
      await cargarPedidos();

    } catch (err) {
      console.error('Error guardando cambios:', err);
      alert(
        `❌ Error al guardar cambios\n\n` +
        `Por favor intenta nuevamente.\n` +
        `Detalle: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FILTRADO DE PEDIDOS
  // ============================================

  const pedidosFiltrados = pedidos.filter(pedido => {
    if (!searchTerm) return true;
    const busqueda = searchTerm.toLowerCase();
    return (
      pedido.numero.toLowerCase().includes(busqueda) ||
      pedido.cliente_nombre.toLowerCase().includes(busqueda)
    );
  });

  // ============================================
  // RENDERIZADO
  // ============================================

  if (loading && pedidos.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Package size={48} className={styles.loadingIcon} />
          <p>Cargando pedidos recibidos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <AlertCircle size={48} />
          <p>{error}</p>
          <button onClick={cargarPedidos} className={styles.btnRetry}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Vista de detalle de pedido
  if (pedidoSeleccionado) {
    return (
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button onClick={() => setPedidoSeleccionado(null)} className={styles.btnBack}>
            <ArrowLeft size={20} />
            Volver a lista
          </button>
          <h2>Pedido {pedidoSeleccionado.numero}</h2>

          {/* Botón Descargar PDF */}
          <button
            onClick={handleDescargarPDF}
            className={styles.btnDescargarPDF}
            title="Descargar comprobante en PDF"
          >
            <Download size={18} />
            Descargar PDF
          </button>
        </div>

        {/* Información del pedido */}
        <div className={styles.pedidoDetalle}>
          <div className={styles.infoSection}>
            <div className={styles.infoItem}>
              <User size={18} />
              <div>
                <span className={styles.infoLabel}>Cliente:</span>
                <span className={styles.infoValue}>{pedidoSeleccionado.cliente_nombre}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Package size={18} />
              <div>
                <span className={styles.infoLabel}>Origen:</span>
                <span className={styles.infoValue}>{pedidoSeleccionado.origen}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha:</span>
              <span className={styles.infoValue}>
                {new Date(pedidoSeleccionado.fecha_pedido).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Productos */}
          <div className={styles.productosSection}>
            <div className={styles.productosHeader}>
              <h3>Productos ({pedidoSeleccionado.productos.length})</h3>
              {!modoEdicion && (
                <button onClick={() => setModoEdicion(true)} className={styles.btnEdit}>
                  <Edit3 size={16} />
                  Editar
                </button>
              )}
            </div>

            {pedidoSeleccionado.productos.map((producto, indexProducto) => (
              <div key={indexProducto} className={styles.productoCard}>
                <div className={styles.productoHeader}>
                  <div>
                    <h4>{producto.codigo} - {producto.nombre}</h4>
                    <p className={styles.productoCategoria}>{producto.categoria}</p>
                    <p className={styles.productoPrecio}>
                      Precio unitario: ${producto.precio_unitario.toLocaleString('es-AR')}
                    </p>
                  </div>
                  {modoEdicion && (
                    <button
                      onClick={() => handleEliminarProducto(producto)}
                      className={styles.btnDeleteProducto}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {/* Variantes */}
                <div className={styles.variantes}>
                  {producto.variantes.map((variante, indexVariante) => (
                    <div key={indexVariante} className={styles.varianteRow}>
                      <span className={styles.varianteColor}>{variante.color}:</span>
                      {modoEdicion ? (
                        <>
                          <div className={styles.quantityControls}>
                            <button
                              onClick={() => handleEditarCantidad(producto, indexVariante, variante.cantidad - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={variante.cantidad}
                              onChange={(e) => handleEditarCantidad(producto, indexVariante, parseInt(e.target.value) || 0)}
                              className={styles.quantityInput}
                            />
                            <button
                              onClick={() => handleEditarCantidad(producto, indexVariante, variante.cantidad + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => handleEliminarVariante(producto, indexVariante)}
                            className={styles.btnDeleteVariante}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <span className={styles.varianteCantidad}>{variante.cantidad} unidades</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Surtido */}
                {producto.surtido > 0 && (
                  <div className={styles.surtidoRow}>
                    <span>Surtido: {producto.surtido} unidades</span>
                  </div>
                )}

                {/* Comentario del producto */}
                {producto.comentario && (
                  <div className={styles.comentarioProducto}>
                    💬 {producto.comentario}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Comentario final */}
          {pedidoSeleccionado.comentario_final && (
            <div className={styles.comentarioFinal}>
              <strong>Comentario final:</strong>
              <p>{pedidoSeleccionado.comentario_final}</p>
            </div>
          )}

          {/* Total */}
          <div className={styles.totalSection}>
            <h3>Total: ${pedidoSeleccionado.total.toLocaleString('es-AR')}</h3>
          </div>

          {/* Botones de acción */}
          <div className={styles.actions}>
            {modoEdicion ? (
              <>
                <button onClick={handleGuardarCambios} className={styles.btnGuardar}>
                  <CheckCircle size={18} />
                  Guardar Cambios
                </button>
                <button onClick={() => setModoEdicion(false)} className={styles.btnCancelar}>
                  <XCircle size={18} />
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAprobarPedido(pedidoSeleccionado)}
                  className={styles.btnAprobar}
                  disabled={loading}
                >
                  <CheckCircle size={18} />
                  Aprobar y Enviar a Depósito
                </button>
                <button
                  onClick={() => handleRechazarPedido(pedidoSeleccionado)}
                  className={styles.btnRechazar}
                  disabled={loading}
                >
                  <XCircle size={18} />
                  Rechazar Pedido
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista de lista de pedidos
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        {onVolverDashboard && (
          <button onClick={onVolverDashboard} className={styles.btnBack}>
            <ArrowLeft size={20} />
            Volver
          </button>
        )}
        <h2>Pedidos Recibidos ({pedidosFiltrados.length})</h2>

        {/* Botón de Notificaciones */}
        {notificacionesActivas ? (
          <button
            onClick={handleDesactivarNotificaciones}
            className={styles.btnNotificacionesActivas}
            title="Desactivar notificaciones"
          >
            <Bell size={20} />
            Notificaciones ON
          </button>
        ) : (
          <button
            onClick={handleActivarNotificaciones}
            className={styles.btnNotificaciones}
            title="Activar notificaciones de nuevos pedidos"
          >
            <BellOff size={20} />
            Activar Notificaciones
          </button>
        )}
      </div>

      {/* Barra de búsqueda */}
      <div className={styles.searchBar}>
        <Search size={20} />
        <input
          type="text"
          placeholder="Buscar por número de pedido o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Info */}
      <div className={styles.infoBox}>
        <AlertCircle size={18} />
        <p>
          Estos son los pedidos recibidos del catálogo web que aún no han sido aprobados.
          Revisa cada pedido y apruébalo para enviarlo al depósito.
        </p>
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className={styles.emptyState}>
          <Package size={64} />
          <h3>No hay pedidos recibidos</h3>
          <p>Los nuevos pedidos del catálogo aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className={styles.pedidosList}>
          {pedidosFiltrados.map((pedido) => (
            <div
              key={pedido.id}
              className={styles.pedidoCard}
              onClick={() => setPedidoSeleccionado(pedido)}
            >
              <div className={styles.pedidoCardHeader}>
                <h3>{pedido.numero}</h3>
                <span className={styles.badge}>{pedido.estado}</span>
              </div>
              <div className={styles.pedidoCardBody}>
                <div className={styles.pedidoInfo}>
                  <User size={16} />
                  <span>{pedido.cliente_nombre}</span>
                </div>
                <div className={styles.pedidoInfo}>
                  <Package size={16} />
                  <span>{pedido.productos.length} productos</span>
                </div>
                <div className={styles.pedidoInfo}>
                  <span className={styles.total}>Total: ${pedido.total.toLocaleString('es-AR')}</span>
                </div>
              </div>
              <div className={styles.pedidoCardFooter}>
                <span className={styles.fecha}>
                  {new Date(pedido.fecha_pedido).toLocaleString('es-AR')}
                </span>
                <button className={styles.btnVer}>
                  <Eye size={16} />
                  Ver Detalle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PedidosRecibidos;
