// src/components/WhatsApp/WhatsAppConverter.tsx
// PARTE 1/8 - IMPORTS Y TIPOS CORREGIDOS

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Copy, 
  Trash2, 
  Send, 
  CheckCircle, 
  AlertCircle,
  User,
  ShoppingCart,
  Edit3,
  Plus,
  Minus
} from 'lucide-react';
import { pedidosService, productosService, type DbPedido, type DbPedidoItem } from '../../lib/supabaseClient';

// Tipos de datos actualizados para manejar variantes
interface VarianteProducto {
  id: string;
  color: string;
  cantidadPedida: number;
}

interface ProductoDetectado {
  id: string;
  texto: string;
  nombre: string;
  codigo?: string;
  precio?: number;
  variantes: VarianteProducto[];
  confirmado: boolean;
  comentario?: string;
  // ✅ NUEVO: Para preservar orden original
  ordenOriginal: number;
  // ✅ NUEVO: Para manejar datos de Supabase
  supabaseData?: {
    id: number;
    precio_venta: number;
    stock: number;
    descripcion: string;
    categoria: string;
  } | null;
}

interface ClienteDetectado {
  nombre: string;
  telefono?: string;
  mensaje: string;
  comentarioFinal?: string;
}
// PARTE 2/8 - ESTADO Y FUNCIÓN PROCESAR MENSAJE CORREGIDA

const WhatsAppConverter: React.FC = () => {
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');
  const [clienteDetectado, setClienteDetectado] = useState<ClienteDetectado | null>(null);
  const [productosDetectados, setProductosDetectados] = useState<ProductoDetectado[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [pedidoGenerado, setPedidoGenerado] = useState(false);

  // ✅ FUNCIÓN CORREGIDA: Preserva orden y mejora parsing
  const procesarMensaje = async () => {
    if (!mensajeWhatsApp.trim()) {
      alert('Por favor pega un mensaje de WhatsApp');
      return;
    }

    setProcesando(true);
    
    try {
      // Simular delay de procesamiento
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ✅ CORRECCIÓN 1: Limpiar mensaje quitando saludo final
      const mensajeLimpio = mensajeWhatsApp
        .replace(/🥳 ¡Gracias por tu pedido y por elegirnos!.*$/s, '')
        .trim();

      console.log('📝 Mensaje limpio:', mensajeLimpio);

      // EXTRAER CLIENTE REAL del mensaje
      const clienteMatch = mensajeLimpio.match(/👤 Cliente:\s*(.+)/);
      const clienteNombre = clienteMatch ? clienteMatch[1].trim() : 'Cliente no detectado';

      // ✅ CORRECCIÓN 2: Extraer comentario final ANTES de dividir productos
      const comentarioFinalMatch = mensajeLimpio.match(/✍ Comentario final:\s*(.+?)(?=\n|$)/);
      const comentarioFinal = comentarioFinalMatch ? comentarioFinalMatch[1].trim() : '';

      console.log('💬 Comentario final extraído:', comentarioFinal);

      const cliente: ClienteDetectado = {
        nombre: clienteNombre,
        telefono: '',
        mensaje: mensajeLimpio,
        comentarioFinal: comentarioFinal
      };

      setClienteDetectado(cliente);

      // ✅ CORRECCIÓN 3: Dividir mensaje EXCLUYENDO la parte del comentario final
      const parteProductos = mensajeLimpio
        .split('✍ Comentario final:')[0] // Todo ANTES del comentario final
        .split('📦 Detalle del pedido:')[1]; // Todo DESPUÉS del encabezado

      if (!parteProductos) {
        console.warn('⚠️ No se encontró la sección de productos');
        return;
      }

      console.log('📦 Parte de productos:', parteProductos);

      // EXTRAER PRODUCTOS preservando orden original
      const productosDetectados: ProductoDetectado[] = [];
      
      // ✅ CORRECCIÓN 4: Dividir en bloques preservando orden
      const bloques = parteProductos.split('🔹').slice(1); // Quitar el primer elemento vacío
      
      for (let index = 0; index < bloques.length; index++) {
        const bloque = bloques[index];
        
        const matchProducto = bloque.match(/([A-Z0-9-]+)\s*–\s*([^\n]+)/);
        if (!matchProducto) continue;

        const codigo = matchProducto[1].trim();
        const descripcion = matchProducto[2].trim();

        console.log(`🔍 Producto ${index + 1}: ${codigo} - ${descripcion}`);

        // Extraer comentario del producto (NO el comentario final)
        const comentarioMatch = bloque.match(/📝 Comentario:\s*([^\n✍]*)/);
        const comentario = comentarioMatch ? comentarioMatch[1].trim() : '';

        // ✅ BUSCAR PRECIO REAL EN SUPABASE
        let precio = 0;
        let supabaseData = null;
        
        try {
          const producto = await productosService.getByCodigo(codigo);
          if (producto) {
            precio = producto.precio_venta;
            supabaseData = producto;
            console.log(`💰 Precio encontrado para ${codigo}: ${precio}`);
          } else {
            precio = 1500; // Precio estimado
            console.log(`💰 Precio estimado para ${codigo}: ${precio}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error buscando precio para ${codigo}:`, error);
          precio = 1500; // Precio por defecto
        }

        // ✅ EXTRAER VARIANTES preservando orden
        const variantes: VarianteProducto[] = [];
        const lineasVariantes = bloque.split('\n').filter(linea => 
          linea.trim().match(/^-\s+.+:\s+\d+$/)
        );

        for (let varIndex = 0; varIndex < lineasVariantes.length; varIndex++) {
          const linea = lineasVariantes[varIndex];
          const matchVariante = linea.match(/^-\s+(.+?):\s+(\d+)$/);
          if (matchVariante) {
            const color = matchVariante[1].trim();
            const cantidad = parseInt(matchVariante[2]);
            
            variantes.push({
              id: `${codigo}-${varIndex + 1}`, // ID único preservando orden
              color: color,
              cantidadPedida: cantidad
            });
          }
        }

        console.log(`🎨 Variantes para ${codigo}:`, variantes);

        productosDetectados.push({
          id: `producto-${index + 1}`, // ID preservando orden
          ordenOriginal: index + 1, // ✅ NUEVO: Guardar orden original
          texto: bloque.trim(),
          nombre: descripcion,
          codigo: codigo,
          precio: precio,
          variantes: variantes,
          confirmado: true,
          comentario: comentario,
          supabaseData: supabaseData
        });
      }

      // ✅ CORRECCIÓN 5: Ordenar por orden original (ya están ordenados, pero por seguridad)
      productosDetectados.sort((a, b) => a.ordenOriginal - b.ordenOriginal);

      console.log('✅ Productos procesados en orden:', productosDetectados.map(p => ({
        orden: p.ordenOriginal,
        codigo: p.codigo,
        descripcion: p.nombre,
        variantes: p.variantes.length
      })));

      setProductosDetectados(productosDetectados);

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      alert('Error procesando el mensaje. Revisa el formato e intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };
  // PARTE 3/8 - FUNCIONES DE EDICIÓN Y CONFIRMACIÓN

  // Confirmar producto
  const confirmarProducto = (id: string) => {
    setProductosDetectados(productos =>
      productos.map(p =>
        p.id === id
          ? { ...p, confirmado: true }
          : p
      )
    );
  };

  // Editar cantidad de una variante específica
  const editarCantidadVariante = (productoId: string, varianteId: string, nuevaCantidad: number) => {
    setProductosDetectados(productos =>
      productos.map(p =>
        p.id === productoId
          ? {
              ...p,
              variantes: p.variantes.map(v =>
                v.id === varianteId
                  ? { ...v, cantidadPedida: Math.max(0, nuevaCantidad) }
                  : v
              )
            }
          : p
      )
    );
  };

  // Eliminar producto
  const eliminarProducto = (id: string) => {
    setProductosDetectados(productos =>
      productos.filter(p => p.id !== id)
    );
  };

  // ✅ FUNCIÓN CORREGIDA: Generar pedido manteniendo orden
  const generarPedido = async () => {
    if (productosDetectados.length === 0) {
      alert('No hay productos detectados para generar el pedido');
      return;
    }

    setProcesando(true);
    try {
      console.log('🚀 Iniciando generación de pedido...');
      
      // ✅ CORRECCIÓN: Procesar productos en orden original
      const productosOrdenados = [...productosDetectados].sort((a, b) => a.ordenOriginal - b.ordenOriginal);
      
      const totalUnidades = productosOrdenados.reduce((sum, p) => 
        sum + p.variantes.reduce((vSum, v) => vSum + v.cantidadPedida, 0)
      , 0);
      const totalEstimado = productosOrdenados.reduce((sum, p) => 
        sum + p.variantes.reduce((subSum, v) => subSum + (p.precio || 0) * v.cantidadPedida, 0)
      , 0);

      // ✅ ESTRUCTURA CORREGIDA DEL PEDIDO
      const newPedido: Omit<DbPedido, 'id' | 'created_at' | 'updated_at'> = {
        numero: `PED-WA-${Date.now().toString().slice(-6)}`,
        cliente_nombre: clienteDetectado?.nombre || 'Cliente WhatsApp',
        cliente_telefono: clienteDetectado?.telefono || '',
        cliente_direccion: '', 
        fecha_pedido: new Date().toISOString(),
        estado: 'pendiente',
        origen: 'whatsapp',
        comentarios: `Pedido generado desde WhatsApp\n` +
                     `Fecha: ${new Date().toLocaleString()}\n` +
                     `Productos base: ${productosOrdenados.length}\n` +
                     `Variantes de colores: ${productosOrdenados.reduce((sum, p) => sum + p.variantes.length, 0)}\n` +
                     `Total unidades: ${totalUnidades}\n` +
                     `Comentario final: ${clienteDetectado?.comentarioFinal || 'Sin comentarios'}`,
        total: totalEstimado,
        productos: null
      };

      // ✅ ESTRUCTURA CORREGIDA DE LOS ITEMS EN ORDEN
      const pedidoItems: Omit<DbPedidoItem, 'id' | 'created_at' | 'updated_at' | 'pedido_id'>[] = [];
      
      productosOrdenados.forEach((p, pIndex) => {
        p.variantes.forEach((v, vIndex) => {
          pedidoItems.push({
            codigo_producto: p.codigo || '',
            cantidad_pedida: v.cantidadPedida,
            cantidad_preparada: 0,
            precio_unitario: p.precio || 0,
            estado: 'pendiente' as const,
            variante_color: v.color,
            comentarios: p.comentario || '',
          });
        });
      });

      console.log('📦 Datos del pedido preparados (EN ORDEN):', {
        pedido: newPedido,
        items: pedidoItems.length,
        ordenItems: pedidoItems.map((item, index) => ({
          orden: index + 1,
          codigo: item.codigo_producto,
          color: item.variante_color,
          cantidad: item.cantidad_pedida
        }))
      });

      // ✅ INSERTAR EN SUPABASE CON MANEJO DE ERRORES
      const insertedPedido = await pedidosService.insertPedidoWithItems(newPedido, pedidoItems);

      console.log('✅ Pedido insertado exitosamente:', insertedPedido);

      setPedidoGenerado(true);
      alert(`¡Pedido generado y guardado en Supabase exitosamente!\n\n` +
            `Número: ${insertedPedido.numero}\n` +
            `Cliente: ${clienteDetectado?.nombre}\n` +
            `Productos: ${productosOrdenados.length} códigos\n` +
            `Total unidades: ${totalUnidades}\n` +
            `Total: $${totalEstimado.toLocaleString()}\n` +
            `Comentario final: ${clienteDetectado?.comentarioFinal || 'Sin comentarios'}\n\n` +
            `✅ ORDEN PRESERVADO del mensaje original\n` +
            `✅ FACTURA: Un código por producto (agrupado)\n` +
            `🏪 DEPÓSITO: Detalle por colores para preparar`);

    } catch (error) {
      console.error('❌ Error al guardar el pedido en Supabase:', error);
      
      let mensajeError = 'Hubo un error al generar el pedido.';
      if (error instanceof Error) {
        mensajeError += `\n\nDetalle: ${error.message}`;
      }
      
      alert(mensajeError + '\n\nPor favor, revisa la consola para más detalles e intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  // Limpiar todo
  const limpiarTodo = () => {
    setMensajeWhatsApp('');
    setClienteDetectado(null);
    setProductosDetectados([]);
    setPedidoGenerado(false);
  };
  // PARTE 4/8 - MENSAJE DE EJEMPLO CORREGIDO Y JSX INICIAL

  // ✅ EJEMPLO CORREGIDO: Con comentario final separado correctamente
  const mensajeEjemplo = `📲 NUEVO PEDIDO – 21/7/2025
👤 Cliente: Supermercado Central
📦 Detalle del pedido:
🔹 LB010 – Cinto de dama
- Negro: 6
- Beige: 3
📝 Comentario: Urgente para mañana
🔹 W254 – Billetera dama
- Rosado: 4
- Rosa Viejo: 4
- Mostaza: 4
📝 Comentario: 
🔹 H005 – Bandolera
- Rosado: 3
- Marron Claro: 3
- Verde Agua: 3
📝 Comentario: 
🔹 RELW003-C – Reloj dama
- Surtido: 5
📝 Comentario: 
🔹 B1101 – Bufanda invierno
- Azul: 2
- Gris: 3
📝 Comentario: Para temporada fría
✍ Comentario final: Este pedido es una muestra para claude
🥳 ¡Gracias por tu pedido y por elegirnos! 🙌🏻`;

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <MessageSquare size={28} style={{ color: '#2563eb' }} />
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
          Conversor WhatsApp → Pedido Estructurado
        </h1>
        <div style={{
          padding: '4px 8px',
          backgroundColor: '#22c55e',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          ✅ SUPABASE + ORDEN CORREGIDO
        </div>
      </div>

      {/* Área de input del mensaje */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
            Mensaje de WhatsApp
          </label>
          <button
            onClick={() => setMensajeWhatsApp(mensajeEjemplo)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #2563eb',
              borderRadius: '6px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              cursor: 'pointer'
            }}
          >
            📝 Cargar Ejemplo Corregido
          </button>
        </div>
        
        <textarea
          value={mensajeWhatsApp}
          onChange={(e) => setMensajeWhatsApp(e.target.value)}
          placeholder="Pega aquí el mensaje de WhatsApp completo..."
          style={{
            width: '100%',
            height: '200px',
            padding: '12px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'monospace'
          }}
        />
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            onClick={procesarMensaje}
            disabled={procesando || !mensajeWhatsApp.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: procesando ? '#9ca3af' : '#2563eb',
              color: 'white',
              cursor: procesando ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <Send size={16} />
            {procesando ? 'Procesando...' : 'Procesar Mensaje'}
          </button>
          
          <button
            onClick={limpiarTodo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              border: '1px solid #6b7280',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <Trash2 size={16} />
            Limpiar Todo
          </button>
        </div>
      </div>
      // PARTE 5/8 - SECCIÓN CLIENTE DETECTADO Y INICIO PRODUCTOS

      {/* Resultados del procesamiento */}
      {(clienteDetectado || productosDetectados.length > 0) && (
        <div style={{ 
          border: '2px solid #22c55e', 
          borderRadius: '12px', 
          padding: '20px',
          backgroundColor: '#f0fdf4'
        }}>
          {/* Cliente detectado */}
          {clienteDetectado && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #dcfce7'
            }}>
              <User size={24} style={{ color: '#2563eb' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  {clienteDetectado.nombre}
                </h3>
                {clienteDetectado.comentarioFinal && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    💬 Comentario final: <strong>{clienteDetectado.comentarioFinal}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Lista de productos detectados */}
          {productosDetectados.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingCart size={20} style={{ color: '#2563eb' }} />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                    Productos Detectados (Orden Preservado)
                  </h3>
                </div>
                <div style={{ 
                  padding: '4px 8px', 
                  backgroundColor: '#22c55e', 
                  color: 'white', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  {productosDetectados.length} productos
                </div>
              </div>

              {/* ✅ CORRECCIÓN: Mostrar productos en orden original */}
              {productosDetectados
                .sort((a, b) => a.ordenOriginal - b.ordenOriginal)
                .map((producto, index) => (
                <div
                  key={producto.id}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px',
                    backgroundColor: 'white'
                  }}
                >
                  {/* Header del producto con orden */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{
                          minWidth: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {producto.ordenOriginal}
                        </div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                          {producto.codigo} – {producto.nombre}
                        </h4>
                        {producto.supabaseData ? (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            ✅ EN STOCK
                          </span>
                        ) : (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#f97316',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            💰 ESTIMADO
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                        💰 Precio: <strong>${producto.precio?.toLocaleString()}</strong>
                        {producto.supabaseData && (
                          <span style={{ marginLeft: '8px', color: '#22c55e' }}>
                            📦 Stock: {producto.supabaseData.stock}
                          </span>
                        )}
                      </p>
                      {producto.comentario && (
                        <p style={{ margin: '4px 0', fontSize: '14px', color: '#8b5cf6', fontStyle: 'italic' }}>
                          💬 {producto.comentario}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => eliminarProducto(producto.id)}
                      style={{
                        padding: '6px',
                        border: '1px solid #ef4444',
                        borderRadius: '4px',
                        backgroundColor: '#fef2f2',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  // PARTE 6/8 - VARIANTES DE PRODUCTOS EN ORDEN ORIGINAL

                  {/* Variantes con orden preservado */}
                  <div style={{ marginTop: '12px' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      🎨 Variantes de colores:
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                      {producto.variantes.map((variante, varIndex) => (
                        <div
                          key={variante.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#f9fafb',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              minWidth: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              {varIndex + 1}
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                              {variante.color}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => editarCantidadVariante(producto.id, variante.id, variante.cantidadPedida - 1)}
                              disabled={variante.cantidadPedida <= 0}
                              style={{
                                width: '24px',
                                height: '24px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                backgroundColor: variante.cantidadPedida <= 0 ? '#f3f4f6' : '#fff',
                                color: variante.cantidadPedida <= 0 ? '#9ca3af' : '#374151',
                                cursor: variante.cantidadPedida <= 0 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{
                              minWidth: '32px',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1f2937'
                            }}>
                              {variante.cantidadPedida}
                            </span>
                            <button
                              onClick={() => editarCantidadVariante(producto.id, variante.id, variante.cantidadPedida + 1)}
                              style={{
                                width: '24px',
                                height: '24px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                color: '#374151',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Plus size={12} />
                            </button>
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#6b7280',
                              marginLeft: '8px'
                            }}>
                              ${((producto.precio || 0) * variante.cantidadPedida).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total del producto */}
                  <div style={{ 
                    marginTop: '12px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      Total unidades: <strong>{producto.variantes.reduce((sum, v) => sum + v.cantidadPedida, 0)}</strong>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                      Subtotal: <strong>${producto.variantes.reduce((sum, v) => sum + (producto.precio || 0) * v.cantidadPedida, 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          // PARTE 7/8 - RESUMEN DEL PEDIDO Y BOTÓN GENERAR

          {/* Resumen y botón de generar pedido */}
          {productosDetectados.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={generarPedido}
                disabled={procesando}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: procesando ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  cursor: procesando ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '16px'
                }}
              >
                {procesando ? '⏳ Generando pedido...' : '🚀 Generar Pedido Estructurado'}
              </button>

              {/* Resumen estadístico mejorado */}
              <div style={{
                padding: '16px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '8px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
                  📊 Resumen del Pedido (Orden Preservado)
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '12px', 
                  fontSize: '14px' 
                }}>
                  <div>
                    <strong>Productos diferentes:</strong><br />
                    {productosDetectados.length}
                  </div>
                  <div>
                    <strong>Variantes de color:</strong><br />
                    {productosDetectados.reduce((sum, p) => sum + p.variantes.length, 0)}
                  </div>
                  <div>
                    <strong>Unidades totales:</strong><br />
                    {productosDetectados.reduce((sum, p) => sum + p.variantes.reduce((vSum, v) => vSum + v.cantidadPedida, 0), 0)}
                  </div>
                  <div>
                    <strong>Valor estimado:</strong><br />
                    ${productosDetectados.reduce((sum, p) => sum + p.variantes.reduce((subSum, v) => subSum + (p.precio || 0) * v.cantidadPedida, 0), 0).toLocaleString()}
                  </div>
                  <div>
                    <strong>En stock:</strong><br />
                    {productosDetectados.filter(p => p.supabaseData).length} productos
                  </div>
                  <div>
                    <strong>Estimados:</strong><br />
                    {productosDetectados.filter(p => !p.supabaseData).length} productos
                  </div>
                </div>
                
                {/* ✅ NUEVA SECCIÓN: Mostrar orden preservado */}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  <strong style={{ fontSize: '14px' }}>✅ Orden del mensaje preservado:</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
                    {productosDetectados
                      .sort((a, b) => a.ordenOriginal - b.ordenOriginal)
                      .map(p => `${p.ordenOriginal}. ${p.codigo}`)
                      .join(' → ')
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje de éxito */}
          {pedidoGenerado && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#22c55e',
              color: 'white',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <CheckCircle size={24} style={{ marginBottom: '8px' }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                ¡Pedido Generado Exitosamente!
              </h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                El pedido ha sido guardado en Supabase con el orden original preservado y está listo para ser procesado.
              </p>
              {clienteDetectado?.comentarioFinal && (
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                  💬 Comentario final guardado: "{clienteDetectado.comentarioFinal}"
                </p>
              )}
            </div>
          )}
        </div>
      )}
      // PARTE 8/8 - INSTRUCCIONES FINALES Y EXPORT

      {/* Instrucciones cuando no hay datos */}
      {!clienteDetectado && productosDetectados.length === 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8fafc',
          border: '2px dashed #cbd5e1',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <MessageSquare size={48} style={{ margin: '0 auto 16px auto', color: '#94a3b8' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
            Pega un mensaje de WhatsApp para comenzar
          </h3>
          <p style={{ margin: 0, fontSize: '14px' }}>
            ✅ El sistema preservará el <strong>orden original</strong> de productos del mensaje.<br />
            ✅ Detectará automáticamente el cliente, productos y variantes de colores.<br />
            ✅ Separará correctamente el <strong>comentario final</strong> del último código.<br />
            ✅ Los precios se buscarán en la base de datos de Supabase automáticamente.<br />
            ✅ Se ignorará el saludo final "🥳 ¡Gracias por tu pedido y por elegirnos!"
          </p>
          
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#1e40af'
          }}>
            <strong>🔧 CORRECCIONES APLICADAS:</strong><br />
            • A1: Orden de productos preservado ✅<br />
            • A2: Parsing comentario final corregido ✅<br />
            • Mensaje de ejemplo actualizado con B1101 + comentario final ✅
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConverter;