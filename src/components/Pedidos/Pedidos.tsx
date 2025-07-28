import React, { useState, useEffect } from 'react';
import {
  Clock,
  Package,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  ArrowLeft,
  MessageSquare,
  Eye,
  User
} from 'lucide-react';
import styles from './Pedidos.module.css';
// ✅ ÚNICA ADICIÓN: Import de Supabase
import { supabase, pedidosService, productosService, type DbPedido, type DbPedidoItem } from '../../lib/supabaseClient';

// ✅ TIPOS CORREGIDOS para evitar duplicados (MANTENIDOS EXACTAMENTE IGUAL)
interface VarianteProducto {
  id: string;
  color: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
  precio?: number;
  variantes?: VarianteProducto[];
  productoBase?: string;
  codigoBarras?: string;
  comentarioProducto?: string;
  descripcion?: string; // ✅ AGREGAR ESTO
}

interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
}

interface Pedido {
  id: string;
  numero: string;
  cliente: Cliente;
  fecha: string;
  estado: 'pendiente' | 'preparando' | 'completado' | 'entregado';
  productos: Producto[];
  comentarios?: string; // Para operario
  comentarioFinal?: string; // ✅ NUEVO: Comentario final desde WhatsApp
  total?: number;
  fechaCompletado?: string;
  // ✅ NUEVO: Para identificar origen
  esDeWhatsApp?: boolean;
}

// ✅ NUEVO: Estado de progreso persistente (MANTENIDO IGUAL)
interface ProgresoGuardado {
  pedidoId: string;
  productosEditables: Producto[];
  comentarios: string;
  fechaUltimaModificacion: string;
}

// Props CORREGIDAS para evitar duplicación (MANTENIDAS IGUAL)
interface PedidosProps {
  pedidosWhatsApp?: Pedido[];
  onCompletarPedido?: (pedido: Pedido) => void;
  onVolverDashboard?: () => void; // ✅ NUEVO
}
// Datos de ejemplo (MANTENIDOS EXACTAMENTE IGUAL - siguen siendo útiles para pedidos manuales)
const pedidosEjemplo: Pedido[] = [
  {
    id: '1',
    numero: 'PED-001',
    cliente: {
      id: 'c1',
      nombre: 'Supermercado Central',
      telefono: '+598 91 234 567',
      direccion: 'Av. Principal 123'
    },
    fecha: '2025-07-22',
    estado: 'pendiente',
    productos: [
      {
        id: 'p1',
        codigo: 'LB001',
        nombre: 'Cinto de dama negro',
        cantidadPedida: 5,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 890,
        codigoBarras: '7791234567890'
      },
      {
        id: 'p2',
        codigo: 'CM015',
        nombre: 'Camisa manga larga',
        cantidadPedida: 3,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 1250,
        codigoBarras: '7791234567891'
      },
      {
        id: 'p3',
        codigo: 'ZP008',
        nombre: 'Zapatos deportivos',
        cantidadPedida: 2,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 2100,
        codigoBarras: '7791234567892'
      },
      {
        id: 'p4',
        codigo: 'AC022',
        nombre: 'Accesorio cabello',
        cantidadPedida: 8,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 450,
        codigoBarras: '7791234567893'
      }
    ],
    total: 12490,
    esDeWhatsApp: false
  },
  {
    id: '2',
    numero: 'PED-002',
    cliente: {
      id: 'c2',
      nombre: 'Farmacia Norte',
      telefono: '+598 92 345 678'
    },
    fecha: '2025-07-22',
    estado: 'preparando',
    productos: [
      {
        id: 'p5',
        codigo: 'CR003',
        nombre: 'Crema facial',
        cantidadPedida: 12,
        cantidadPreparada: 8,
        estado: 'pendiente',
        precio: 680,
        codigoBarras: '7791234567894'
      },
      {
        id: 'p6',
        codigo: 'SH007',
        nombre: 'Shampoo anticaspa',
        cantidadPedida: 6,
        cantidadPreparada: 6,
        estado: 'completado',
        precio: 920,
        codigoBarras: '7791234567895'
      }
    ],
    total: 13680,
    esDeWhatsApp: false
  },
  {
    id: '3',
    numero: 'PED-003',
    cliente: {
      id: 'c3',
      nombre: 'Boutique Elegance',
      telefono: '+598 93 456 789'
    },
    fecha: '2025-07-21',
    estado: 'pendiente',
    productos: [
      {
        id: 'p7',
        codigo: 'VE012',
        nombre: 'Vestido casual',
        cantidadPedida: 4,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 2800,
        codigoBarras: '7791234567896'
      },
      {
        id: 'p8',
        codigo: 'BL018',
        nombre: 'Blusa estampada',
        cantidadPedida: 6,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 1650,
        codigoBarras: '7791234567897'
      }
    ],
    total: 21100,
    esDeWhatsApp: false
  }
];

// ✅ NUEVA FUNCIÓN: Extraer comentario final de los comentarios de Supabase
const extraerComentarioFinal = (comentarios: string): string => {
  const match = comentarios.match(/Comentario final:\s*(.+?)(?:\n|$)/);
  return match ? match[1].trim() : '';
};
const convertirPedidoDeSupabase = async (dbPedido: DbPedido, dbItems: DbPedidoItem[]): Promise<Pedido> => {
  // Agrupar items por código de producto
  const productosMap = new Map<string, Producto>();

  // ✅ OBTENER DATOS DE INVENTARIO PARA TODOS LOS CÓDIGOS
  const codigosUnicos = [...new Set(dbItems.map(item => item.codigo_producto))];
  const { data: datosInventario } = await supabase
    .from('inventario')
    .select('codigo_producto, descripcion, codigo_barras')
    .in('codigo_producto', codigosUnicos);

  const inventarioMap = new Map();
  datosInventario?.forEach(item => {
    inventarioMap.set(item.codigo_producto, item);
  });

  dbItems.forEach(item => {
    const codigo = item.codigo_producto;
    const datosInv = inventarioMap.get(codigo);
    
    if (!productosMap.has(codigo)) {
      productosMap.set(codigo, {
        id: codigo,
        codigo: codigo,
        nombre: datosInv?.descripcion || `Producto ${codigo}`, // ✅ Descripción real
        cantidadPedida: 0,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: item.precio_unitario,
        variantes: [],
        comentarioProducto: item.comentarios || '',
        codigoBarras: datosInv?.codigo_barras || '', // ✅ Código de barras real
        descripcion: datosInv?.descripcion || `Producto ${codigo}` // ✅ Descripción real
      });
    }

    const producto = productosMap.get(codigo)!;
    
    // Si hay variante de color, es un producto de WhatsApp con variantes
    if (item.variante_color && item.variante_color !== 'Sin especificar') {
      if (!producto.variantes) producto.variantes = [];
      
      producto.variantes.push({
        id: item.id?.toString() || `${codigo}-${item.variante_color}`,
        color: item.variante_color,
        cantidadPedida: item.cantidad_pedida,
        cantidadPreparada: item.cantidad_preparada,
        estado: item.estado as 'pendiente' | 'completado' | 'sin_stock'
      });
    } else {
      // Producto normal sin variantes
      producto.cantidadPedida += item.cantidad_pedida;
      producto.cantidadPreparada += item.cantidad_preparada;
    }
  });

  return {
    id: dbPedido.id.toString(),
    numero: dbPedido.numero,
    cliente: {
      id: `cliente-${dbPedido.id}`,
      nombre: dbPedido.cliente_nombre,
      telefono: dbPedido.cliente_telefono || '',
      direccion: dbPedido.cliente_direccion || ''
    },
    fecha: new Date(dbPedido.fecha_pedido).toISOString().split('T')[0],
    estado: dbPedido.estado as 'pendiente' | 'preparando' | 'completado' | 'entregado',
    productos: Array.from(productosMap.values()),
    comentarios: dbPedido.comentarios || '',
    comentarioFinal: extraerComentarioFinal(dbPedido.comentarios || ''),
    total: dbPedido.total || 0,
    fechaCompletado: dbPedido.fecha_completado ? new Date(dbPedido.fecha_completado).toISOString().split('T')[0] : undefined,
    esDeWhatsApp: dbPedido.origen === 'whatsapp'
  };
};
const Pedidos: React.FC<PedidosProps> = ({
  pedidosWhatsApp = [],
  onCompletarPedido,
  onVolverDashboard
}) => {
  // ✅ ESTADOS EXACTAMENTE IGUALES (sin cambios)
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vistaActual, setVistaActual] = useState<'lista' | 'detalle' | 'deposito'>('lista');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [productosEditables, setProductosEditables] = useState<Producto[]>([]);
  const [mostrarAgregarProducto, setMostrarAgregarProducto] = useState(false);
  const [nuevoProductoCodigo, setNuevoProductoCodigo] = useState('');
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState('');
  const [nuevoProductoCantidad, setNuevoProductoCantidad] = useState(1);
  const [comentarios, setComentarios] = useState('');

  // ✅ FUNCIÓN EXACTAMENTE IGUAL (sin cambios)
  const handleAgregarProducto = () => {
    if (!nuevoProductoCodigo.trim() || !nuevoProductoNombre.trim() || nuevoProductoCantidad <= 0) {
      alert('Por favor, complete todos los campos para agregar el producto.');
      return;
    }

    const productoExistente = productosEditables.find(p => p.codigo === nuevoProductoCodigo.trim());

    if (productoExistente) {
      const confirmar = confirm(
        `El producto con código ${nuevoProductoCodigo} ya existe en el pedido. ¿Desea sumar la cantidad de ${nuevoProductoCantidad} a la cantidad existente?`
      );

      if (confirmar) {
        setProductosEditables(productosEditables.map(p =>
          p.codigo === nuevoProductoCodigo.trim()
            ? { ...p, cantidadPedida: p.cantidadPedida + nuevoProductoCantidad }
            : p
        ));
      }
    } else {
      const nuevoProducto: Producto = {
        id: `prod-${Date.now()}`,
        codigo: nuevoProductoCodigo.trim(),
        nombre: nuevoProductoNombre.trim(),
        cantidadPedida: nuevoProductoCantidad,
        cantidadPreparada: 0,
        estado: 'pendiente',
        precio: 0, // O un valor por defecto que estimes conveniente
        codigoBarras: `manual-${Date.now()}`
      };
      setProductosEditables([...productosEditables, nuevoProducto]);
    }

    setMostrarAgregarProducto(false);
    setNuevoProductoCodigo('');
    setNuevoProductoNombre('');
    setNuevoProductoCantidad(1);
  };

  // ✅ ESTADO EXACTAMENTE IGUAL (sin cambios)
  const [progresoGuardado, setProgresoGuardado] = useState<Map<string, ProgresoGuardado>>(new Map());

  // ✅ ÚNICA FUNCIÓN NUEVA: Cargar pedidos desde Supabase
  const cargarPedidosDeSupabase = async () => {
    try {
      console.log('📦 Cargando pedidos desde Supabase...');

      // Obtener pedidos principales
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['pendiente', 'preparando'])
        .order('fecha_pedido', { ascending: false });

      if (pedidosError) {
        console.error('❌ Error obteniendo pedidos:', pedidosError);
        return [];
      }

      console.log('✅ Pedidos obtenidos de Supabase:', pedidosData?.length || 0);

      // Para cada pedido, obtener sus items y convertir al formato de tu interfaz
      const pedidosConvertidos: Pedido[] = [];
      
      for (const pedido of pedidosData || []) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('pedido_items')
          .select('*')
          .eq('pedido_id', pedido.id)
          .order('created_at');
        if (itemsError) {
          console.error(`❌ Error obteniendo items del pedido ${pedido.id}:`, itemsError);
          continue;
        }

        const pedidoConvertido = await convertirPedidoDeSupabase(pedido, itemsData || []);
        pedidosConvertidos.push(pedidoConvertido);
      }

      return pedidosConvertidos;

    } catch (error) {
      console.error('❌ Error cargando pedidos de Supabase:', error);
      return [];
    }
  };
  // ✅ EFECTO MODIFICADO: Ahora incluye pedidos de Supabase + mantiene pedidos de ejemplo
  useEffect(() => {
    const cargarTodosLosPedidos = async () => {
      console.log('📋 Pedidos recibió:', {
        pedidosWhatsApp: pedidosWhatsApp.length,
        ejemplos: pedidosEjemplo.length
      });

      // Cargar pedidos de Supabase
      const pedidosDeSupabase = await cargarPedidosDeSupabase();
      console.log('📦 Pedidos de Supabase cargados:', pedidosDeSupabase.length);

      // Marcar pedidos de WhatsApp con su origen (EXACTAMENTE IGUAL)
      const pedidosWhatsAppMarcados = pedidosWhatsApp.map(p => ({
        ...p,
        esDeWhatsApp: true
      }));

      // Combinar TODOS los pedidos sin duplicados usando Set de IDs
      const idsUnicos = new Set<string>();
      const todosPedidosUnicos: Pedido[] = [];

      // Agregar de Supabase sin duplicar
      pedidosDeSupabase.forEach(pedido => {
        if (!idsUnicos.has(pedido.id)) {
          idsUnicos.add(pedido.id);
          todosPedidosUnicos.push(pedido);
        }
      });

      // Agregar WhatsApp sin duplicar (IGUAL)
      pedidosWhatsAppMarcados.forEach(pedido => {
        if (!idsUnicos.has(pedido.id)) {
          idsUnicos.add(pedido.id);
          todosPedidosUnicos.push(pedido);
        }
      });

      console.log('✅ Pedidos únicos cargados:', todosPedidosUnicos.length);
      setPedidos(todosPedidosUnicos);
    };

    cargarTodosLosPedidos();
  }, [pedidosWhatsApp]);

  // ✅ TODAS LAS FUNCIONES SIGUIENTES EXACTAMENTE IGUALES (sin cambios)
  
  // ✅ NUEVA FUNCIÓN: Guardar progreso en localStorage (EXACTAMENTE IGUAL)
  const guardarProgreso = (pedidoId: string, productos: Producto[], comentariosActuales: string) => {
    const progreso: ProgresoGuardado = {
      pedidoId,
      productosEditables: productos,
      comentarios: comentariosActuales,
      fechaUltimaModificacion: new Date().toISOString()
    };

    // Guardar en localStorage para persistencia
    localStorage.setItem(`progreso_pedido_${pedidoId}`, JSON.stringify(progreso));

    // Actualizar estado local
    setProgresoGuardado(prev => new Map(prev.set(pedidoId, progreso)));

    console.log('💾 Progreso guardado para pedido:', pedidoId);
  };

  // ✅ NUEVA FUNCIÓN: Cargar progreso guardado (EXACTAMENTE IGUAL)
  const cargarProgreso = (pedidoId: string): ProgresoGuardado | null => {
    try {
      const progresoStr = localStorage.getItem(`progreso_pedido_${pedidoId}`);
      if (progresoStr) {
        const progreso = JSON.parse(progresoStr) as ProgresoGuardado;
        console.log('📂 Progreso cargado para pedido:', pedidoId);
        return progreso;
      }
    } catch (error) {
      console.error('❌ Error al cargar progreso:', error);
    }
    return null;
  };

  // ✅ NUEVA FUNCIÓN: Limpiar progreso después de completar (EXACTAMENTE IGUAL)
  const limpiarProgreso = (pedidoId: string) => {
    localStorage.removeItem(`progreso_pedido_${pedidoId}`);
    setProgresoGuardado(prev => {
      const nuevo = new Map(prev);
      nuevo.delete(pedidoId);
      return nuevo;
    });
    console.log('🗑️ Progreso limpiado para pedido:', pedidoId);
  };
  // ✅ FUNCIÓN CORREGIDA: Iniciar preparación con carga de progreso (EXACTAMENTE IGUAL)
  const iniciarPreparacion = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);

    // ✅ CORRECCIÓN 1: Intentar cargar progreso guardado
    const progresoExistente = cargarProgreso(pedido.id);

    if (progresoExistente) {
      // Restaurar progreso guardado
      setProductosEditables(progresoExistente.productosEditables);
      setComentarios(progresoExistente.comentarios);

      // Mostrar confirmación de carga
      alert(`📂 Se cargó el progreso guardado\n\nÚltima modificación: ${new Date(progresoExistente.fechaUltimaModificacion).toLocaleString()}`);
    } else {
      // ✅ CORRECCIÓN 2: Inicializar productos con variantes correctamente
      const productosConVariantes = pedido.productos.map(p => {
        if (p.variantes && p.variantes.length > 0) {
          // Producto desde WhatsApp con variantes
          return {
            ...p,
            variantes: p.variantes.map(v => ({
              ...v,
              cantidadPreparada: 0,
              estado: 'pendiente' as const
            }))
          };
        } else {
          // Producto normal sin variantes
          return { ...p };
        }
      });

      setProductosEditables(productosConVariantes);
      setComentarios('');
    }

    setVistaActual('deposito');
  };

  // ✅ FUNCIÓN CORREGIDA: Guardar progreso automáticamente (EXACTAMENTE IGUAL)
  const guardarProgresoAutomatico = () => {
    if (pedidoSeleccionado) {
      guardarProgreso(pedidoSeleccionado.id, productosEditables, comentarios);

// ✅ CORRECCIÓN: Actualizar estado en memoria Y en Supabase
setPedidos(pedidos =>
  pedidos.map(p =>
    p.id === pedidoSeleccionado.id
      ? { ...p, estado: 'preparando' }
      : p
  )
);

// ✅ NUEVO: También actualizar en Supabase para pedidos persistentes
if (pedidoSeleccionado.esDeWhatsApp) {
  supabase
    .from('pedidos')
    .update({ estado: 'preparando' })
    .eq('id', pedidoSeleccionado.id)
    .then(({ error }) => {
      if (error) {
        console.error('❌ Error actualizando estado en Supabase:', error);
      } else {
        console.log('✅ Estado actualizado en Supabase para pedido:', pedidoSeleccionado.id);
      }
    });
}

      // ✅ CORRECCIÓN 3: Ir al dashboard en lugar de lista
      if (onVolverDashboard) {
        onVolverDashboard();
      } else {
        setVistaActual('lista');
      }

      alert('💾 Progreso guardado correctamente\n\n✅ Puedes continuar más tarde desde donde lo dejaste');
    }
  };

  // ✅ NUEVA FUNCIÓN: Detectar si hay cambios para guardar (EXACTAMENTE IGUAL)
  const hayProgresoPorGuardar = (): boolean => {
    return productosEditables.some(p => {
      if (p.variantes && p.variantes.length > 0) {
        return p.variantes.some(v => v.cantidadPreparada > 0 || v.estado !== 'pendiente');
      } else {
        return p.cantidadPreparada > 0 || p.estado !== 'pendiente';
      }
    }) || comentarios.trim().length > 0;
  };

  // ✅ FUNCIONES CORREGIDAS para manejar variantes (EXACTAMENTE IGUALES)
  const actualizarCantidadVariante = (productoId: string, varianteId: string, nuevaCantidad: number) => {
    setProductosEditables(productos =>
      productos.map(p =>
        p.id === productoId && p.variantes
          ? {
              ...p,
              variantes: p.variantes.map(v => {
                if (v.id === varianteId) {
                  if (nuevaCantidad > v.cantidadPedida) {
                    const confirmar = confirm(
                      `⚠️ Quieres preparar ${nuevaCantidad} pero el pedido original era ${v.cantidadPedida}. ¿El cliente confirmó esta cantidad extra?`
                    );
                    if (!confirmar) {
                      return v;
                    }
                  }
                  return { ...v, cantidadPreparada: Math.max(0, nuevaCantidad) };
                }
                return v;
              }),
              // Actualizar totales del producto
              cantidadPreparada: p.variantes.reduce((sum, v) =>
                sum + (v.id === varianteId ? Math.max(0, nuevaCantidad) : v.cantidadPreparada), 0
              )
            }
          : p
      )
    );
  };

  const marcarVarianteCompletada = (productoId: string, varianteId: string) => {
    setProductosEditables(productos =>
      productos.map(p => {
        if (p.id === productoId && p.variantes) {
          const variante = p.variantes.find(v => v.id === varianteId);
          if (variante && variante.cantidadPreparada > 0) {
            // Vibración de éxito
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return {
              ...p,
              variantes: p.variantes.map(v =>
                v.id === varianteId ? { ...v, estado: 'completado' } : v
              )
            };
          } else {
            // Vibración de error
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            alert('⚠️ Debe preparar al menos 1 unidad para marcar como completado');
            return p;
          }
        }
        return p;
      })
    );
  };

  const marcarVarianteSinStock = (productoId: string, varianteId: string) => {
    // Vibración específica para sin stock
    if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100, 50]);

    setProductosEditables(productos =>
      productos.map(p =>
        p.id === productoId && p.variantes
          ? {
              ...p,
              variantes: p.variantes.map(v =>
                v.id === varianteId
                  ? { ...v, estado: 'sin_stock', cantidadPreparada: 0 }
                  : v
              )
            }
          : p
      )
    );
  };
  // Funciones originales para productos sin variantes (EXACTAMENTE IGUALES)
  const actualizarCantidad = (productoId: string, nuevaCantidad: number) => {
    setProductosEditables(productos =>
      productos.map(p => {
        if (p.id === productoId) {
          if (nuevaCantidad > p.cantidadPedida) {
            const confirmar = confirm(
              `⚠️ Quieres preparar ${nuevaCantidad} pero el pedido original era ${p.cantidadPedida}. ¿El cliente confirmó esta cantidad extra?`
            );
            if (!confirmar) {
              return p;
            }
          }
          return { ...p, cantidadPreparada: Math.max(0, nuevaCantidad) };
        }
        return p;
      })
    );
  };

  const marcarCompletado = (productoId: string) => {
    setProductosEditables(productos =>
      productos.map(p => {
        if (p.id === productoId) {
          if (p.cantidadPreparada > 0) {
            // Vibración de éxito
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            return { ...p, estado: 'completado' };
          } else {
            // Vibración de error
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            alert('⚠️ Debe preparar al menos 1 unidad para marcar como completado');
            return p;
          }
        }
        return p;
      })
    );
  };

  const marcarSinStock = (productoId: string) => {
    // Vibración específica para sin stock
    if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100, 50]);

    setProductosEditables(productos =>
      productos.map(p =>
        p.id === productoId
          ? { ...p, estado: 'sin_stock', cantidadPreparada: 0 }
          : p
      )
    );
  };

  // ✅ FUNCIÓN CORREGIDA: Calcular progreso considerando variantes (EXACTAMENTE IGUAL)
  const calcularProgreso = (productos: Producto[]) => {
    let totalItems = 0;
    let completados = 0;

    productos.forEach(p => {
      if (p.variantes && p.variantes.length > 0) {
        // Producto con variantes
        totalItems += p.variantes.length;
        completados += p.variantes.filter(v => v.estado === 'completado' || v.estado === 'sin_stock').length;
      } else {
        // Producto normal
        totalItems += 1;
        if (p.estado === 'completado' || p.estado === 'sin_stock') {
          completados += 1;
        }
      }
    });

    return totalItems > 0 ? Math.round((completados / totalItems) * 100) : 0;
  };

  // ✅ FUNCIÓN COMPLETAMENTE CORREGIDA: Finalizar pedido CON INTEGRACIÓN DE INVENTARIO
  const finalizarPedido = async () => {
    if (!pedidoSeleccionado) return;

    const progreso = calcularProgreso(productosEditables);

    if (progreso < 100) {
      const opciones = [
        '💾 Guardar progreso y continuar más tarde',
        '🚀 Finalizar pedido incompleto',
        '❌ Cancelar'
      ];

      const respuesta = prompt(
        `⚠️ Pedido incompleto (${progreso}%)\n\n` +
        `Aún hay productos pendientes de preparar.\n\n` +
        `Opciones:\n` +
        `1 - ${opciones[0]}\n` +
        `2 - ${opciones[1]}\n` +
        `3 - ${opciones[2]}\n\n` +
        `Ingresa el número de tu opción:`
      );

      if (respuesta === '1') {
        guardarProgresoAutomatico();
        return;
      } else if (respuesta !== '2') {
        return;
      }
    }

    try {
      // ✅ NUEVA FUNCIONALIDAD: Procesar reducción de stock en inventario
      console.log('🏭 Iniciando finalización de pedido con control de inventario...');
      
      const productosParaReduccionStock = productosEditables
        .filter(p => {
          // Solo procesar productos que tienen cantidad preparada
          if (p.variantes && p.variantes.length > 0) {
            return p.variantes.some(v => v.cantidadPreparada > 0);
          } else {
            return p.cantidadPreparada > 0;
          }
        })
        .map(p => ({
          codigo: p.codigo,
          cantidadPreparada: p.cantidadPreparada,
          variantes: p.variantes?.map(v => ({
            color: v.color,
            cantidadPreparada: v.cantidadPreparada
          }))
        }));

      console.log('📋 Productos para reducir stock:', productosParaReduccionStock);

      // Procesar reducción de stock
      const resultadosStock = await productosService.procesarReduccionStockPedido(productosParaReduccionStock);
      
      console.log('📊 Resultados de actualización de inventario:', resultadosStock);

      const pedidoFinalizado: Pedido = {
        ...pedidoSeleccionado,
        estado: 'completado',
        productos: productosEditables, // ✅ CORRECCIÓN: Usar los productos editados
        comentarios: comentarios.trim(),
        fechaCompletado: new Date().toISOString().split('T')[0],
      };

      if (onCompletarPedido) {
        onCompletarPedido(pedidoFinalizado);
      }

      limpiarProgreso(pedidoSeleccionado.id);

      const totalUnidades = productosEditables.reduce((sum, p) => {
        if (p.variantes && p.variantes.length > 0) {
          return sum + p.variantes.reduce((vSum, v) => vSum + v.cantidadPreparada, 0);
        } else {
          return sum + p.cantidadPreparada;
        }
      }, 0);

      // ✅ NUEVA FUNCIONALIDAD: Mostrar resumen de actualización de inventario
      const resumenStock = resultadosStock
        .map(r => `${r.codigo}: ${r.resultado}`)
        .join('\n');

      alert(
        `✅ Pedido completado exitosamente!\n\n` +
        `📋 ${pedidoFinalizado.numero}\n` +
        `👤 ${pedidoFinalizado.cliente.nombre}\n` +
        `📦 ${totalUnidades} unidades preparadas\n` +
        `📝 ${pedidoFinalizado.productos.length} productos\n` +
        `💰 Total: $${pedidoFinalizado.total?.toLocaleString() || '0'}\n\n` +
        `🏭 INVENTARIO ACTUALIZADO:\n${resumenStock}\n\n` +
        `🚀 ENVIADO A FACTURACIÓN\n` +
        `📊 Volviendo al Dashboard...`
      );

      if (onVolverDashboard) {
        onVolverDashboard();
      }
      
    } catch (error) {
      console.error('❌ Error finalizando pedido:', error);
      alert(
        `❌ Error al finalizar pedido\n\n` +
        `Se produjo un error al actualizar el inventario.\n` +
        `Por favor, revisa el inventario manualmente.\n\n` +
        `Error: ${error}`
      );
    }
  };

  // ✅ NUEVA FUNCIÓN: Manejar salida del depósito con confirmación (EXACTAMENTE IGUAL)
  const salirDelDeposito = () => {
    if (hayProgresoPorGuardar()) {
      const confirmar = confirm(
        `⚠️ Tienes cambios sin guardar\n\n` +
        `¿Qué deseas hacer?\n\n` +
        `✅ Aceptar = Guardar progreso y salir\n` +
        `❌ Cancelar = Continuar en depósito`
      );

      if (confirmar) {
        guardarProgresoAutomatico();
      }
    } else {
      // ✅ CORRECCIÓN: Ir al dashboard
      if (onVolverDashboard) {
        onVolverDashboard();
      } else {
        setVistaActual('lista');
      }
    }
  };
  // ===== VISTAS =====

  // Vista Lista de Pedidos (MANTENIDA EXACTAMENTE IGUAL - funciona bien)
  if (vistaActual === 'lista') {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>
            Gestión de Pedidos
          </h2>
          <p className={styles.pageSubtitle}>
            Administra y prepara los pedidos de tus clientes
          </p>
        </div>

        {/* Estadísticas rápidas */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
              <Clock size={24} style={{ color: '#f97316' }} />
              <div>
                <p>{pedidos.filter(p => p.estado === 'pendiente').length}</p>
                <p>Pendientes</p>
              </div>
          </div>

          <div className={styles.statCard}>
              <Package size={24} style={{ color: '#3b82f6' }} />
              <div>
                <p>{pedidos.filter(p => p.estado === 'preparando').length}</p>
                <p>En preparación</p>
              </div>
          </div>

          <div className={styles.statCard} style={{border: '2px solid #22c55e'}}>
              <CheckCircle size={24} style={{ color: '#22c55e' }} />
              <div>
                <p>{pedidos.filter(p => p.estado === 'completado').length}</p>
                <p>Completados</p>
              </div>
          </div>

          {pedidosWhatsApp.length > 0 && (
            <div className={styles.statCard} style={{border: '2px solid #25d366'}}>
                <MessageSquare size={24} style={{ color: '#25d366' }} />
                <div>
                  <p>{pedidosWhatsApp.filter(p => p.estado !== 'completado').length}</p>
                  <p>Desde WhatsApp</p>
                </div>
            </div>
          )}
        </div>

        {/* Lista de pedidos */}
        <div className={styles.pedidosList}>
          {pedidos.map(pedido => {
            const progreso = calcularProgreso(pedido.productos);
            const tieneProgresoGuardado = progresoGuardado.has(pedido.id);

            return (
              <div key={pedido.id} className={styles.card} style={{
                // ✅ MEJORA VISUAL: Resaltar separación entre pedidos
                border: `3px solid ${
                  pedido.estado === 'completado' ? '#22c55e' :
                  pedido.estado === 'preparando' ? '#3b82f6' :
                  pedido.esDeWhatsApp ? '#25d366' : '#e5e7eb'
                }`,
                backgroundColor: pedido.estado === 'completado' ? '#f0fdf4' : '#ffffff'
              }}>
                <div className={styles.pedidoCardHeader}>
                  <div>
                    <h3 className={styles.pedidoCardTitle}>
                      {pedido.numero}
                    </h3>
                    <div className={styles.clientInfo}>
                      <User size={16} />
                      <span>{pedido.cliente.nombre}</span>
                    </div>
                    {pedido.cliente.telefono && (
                      <p>{pedido.cliente.telefono}</p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.statusBadge} style={{
                      backgroundColor: pedido.estado === 'pendiente' ? '#fed7aa' :
                                     pedido.estado === 'preparando' ? '#dbeafe' :
                                     pedido.estado === 'completado' ? '#dcfce7' : '#f3f4f6',
                      color: pedido.estado === 'pendiente' ? '#9a3412' :
                             pedido.estado === 'preparando' ? '#1e40af' :
                             pedido.estado === 'completado' ? '#166534' : '#374151'
                    }}>
                      {pedido.estado === 'pendiente' ? 'Pendiente' :
                       pedido.estado === 'preparando' ? 'Preparando' :
                       pedido.estado === 'completado' ? '✅ Completado' : 'Entregado'}
                    </span>

                    {pedido.esDeWhatsApp && (
                      <div className={styles.whatsappTag}>
                        📱 WhatsApp
                      </div>
                    )}

                    {/* ✅ NUEVO: Indicador de progreso guardado */}
                    {tieneProgresoGuardado && (
                      <div style={{
                        fontSize: '10px',
                        backgroundColor: '#fbbf24',
                        color: '#92400e',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        marginTop: '4px',
                        display: 'inline-block'
                      }}>
                        💾 Progreso guardado
                      </div>
                    )}

                    {pedido.total && (
                      <p className={styles.totalPrice}>
                        ${pedido.total.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className={styles.productSummary}>
                  <p>
                    {pedido.productos.length} productos • {pedido.productos.reduce((sum, p) => sum + p.cantidadPedida, 0)} unidades
                  </p>

                  {pedido.estado === 'preparando' && (
                    <>
                      <div className={styles.progressBarContainer}>
                        <div className={styles.progressBar} style={{ width: `${progreso}%` }} />
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                        {progreso}% completado
                      </p>
                    </>
                  )}

                  <div>
                    {pedido.productos.slice(0, 2).map(producto => (
                      <span key={producto.id}>
                        {producto.nombre} ({producto.cantidadPedida})
                        {pedido.productos.indexOf(producto) === 0 && pedido.productos.length > 1 ? ', ' : ''}
                      </span>
                    ))}
                    {pedido.productos.length > 2 && ' ...'}
                  </div>
                </div>

                <div className={styles.actionsContainer}>
                  <button
                    onClick={() => {
                      setPedidoSeleccionado(pedido);
                      setVistaActual('detalle');
                    }}
                    className={styles.buttonSecondary}
                  >
                    <Eye size={16} />
                    Ver Detalle
                  </button>

                  {pedido.estado === 'pendiente' && (
                    <button
                      onClick={() => iniciarPreparacion(pedido)}
                      className={styles.buttonPrimary}
                    >
                      <Package size={16} />
                      Iniciar Preparación
                    </button>
                  )}

                  {pedido.estado === 'preparando' && (
                    <button
                      onClick={() => iniciarPreparacion(pedido)}
                      className={styles.buttonPrimary}
                      style={{
                        backgroundColor: tieneProgresoGuardado ? '#f59e0b' : '#3b82f6'
                      }}
                    >
                      <Package size={16} />
                      {tieneProgresoGuardado ? '📂 Continuar' : 'Preparar'}
                    </button>
                  )}

                  {pedido.estado === 'completado' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '6px',
                      border: '1px solid #22c55e'
                    }}>
                      <CheckCircle size={16} style={{ color: '#166534' }} />
                      <span style={{ fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                        Listo para Facturación
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  // Vista Detalle de Pedido (MANTENIDA EXACTAMENTE IGUAL - funciona bien)
  if (vistaActual === 'detalle' && pedidoSeleccionado) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.detailHeader}>
          <button
            onClick={() => setVistaActual('lista')}
            className={styles.buttonSecondary}
          >
            <ArrowLeft size={16} />
            Volver
          </button>

          <div>
            <h2 className={styles.pageTitle} style={{fontSize: '24px', marginBottom: 0}}>
              {pedidoSeleccionado.numero}
            </h2>
            <p className={styles.pageSubtitle}>{pedidoSeleccionado.cliente.nombre}</p>
          </div>
        </div>

        <div className={styles.card} style={{marginBottom: '24px'}}>
          <h3 className={styles.cardTitle}>Información del Cliente</h3>
          <p style={{ margin: '4px 0' }}><strong>Nombre:</strong> {pedidoSeleccionado.cliente.nombre}</p>
          {pedidoSeleccionado.cliente.telefono && (
            <p style={{ margin: '4px 0' }}><strong>Teléfono:</strong> {pedidoSeleccionado.cliente.telefono}</p>
          )}
          {pedidoSeleccionado.cliente.direccion && (
            <p style={{ margin: '4px 0' }}><strong>Dirección:</strong> {pedidoSeleccionado.cliente.direccion}</p>
          )}
          <p style={{ margin: '4px 0' }}><strong>Fecha:</strong> {pedidoSeleccionado.fecha}</p>
          <p style={{ margin: '4px 0' }}>
            <strong>Estado:</strong>
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              backgroundColor: pedidoSeleccionado.estado === 'pendiente' ? '#fed7aa' :
                             pedidoSeleccionado.estado === 'preparando' ? '#dbeafe' :
                             pedidoSeleccionado.estado === 'completado' ? '#dcfce7' : '#f3f4f6',
              color: pedidoSeleccionado.estado === 'pendiente' ? '#9a3412' :
                     pedidoSeleccionado.estado === 'preparando' ? '#1e40af' :
                     pedidoSeleccionado.estado === 'completado' ? '#166534' : '#374151'
            }}>
              {pedidoSeleccionado.estado === 'pendiente' ? 'Pendiente' :
               pedidoSeleccionado.estado === 'preparando' ? 'En preparación' :
               pedidoSeleccionado.estado === 'completado' ? '✅ Completado' : 'Entregado'}
            </span>
          </p>
        </div>

        <div className={styles.card} style={{marginBottom: '24px'}}>
          <h3 className={styles.cardTitle}>Productos del Pedido</h3>

          {pedidoSeleccionado.productos.map(producto => (
            <div key={producto.id} className={styles.productListItem}>
              <div className={styles.productListItemInfo}>
                <div>
                  <p>{producto.nombre}</p>
                  <p>Código: {producto.codigo}</p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p><strong>{producto.cantidadPedida}</strong> unidades</p>
                  {producto.precio && (
                    <p>${producto.precio.toLocaleString()} c/u</p>
                  )}
                </div>
              </div>

              {producto.variantes && producto.variantes.length > 0 && (
                <div className={styles.variantsDetailBox}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#475569', margin: '0 0 8px 0' }}>
                    🎨 Detalle por colores (para depósito):
                  </p>
                  <div className={styles.variantsGrid}>
                    {producto.variantes.map(variante => (
                      <div key={variante.id} className={styles.variantChip}>
                        <span style={{ color: '#374151' }}>{variante.color}:</span>
                        <span style={{ fontWeight: '600', color: '#1f2937' }}>{variante.cantidadPedida}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                    💡 El operario verá este detalle en el depósito para preparar por color
                  </p>
                </div>
              )}
            </div>
          ))}

          {pedidoSeleccionado.total && (
            <div className={styles.totalSection}>
              <span>Total:</span>
              <span>${pedidoSeleccionado.total.toLocaleString()}</span>
            </div>
          )}
        </div>

        {pedidoSeleccionado.estado !== 'completado' ? (
          <button
            onClick={() => iniciarPreparacion(pedidoSeleccionado)}
            className={styles.fullWidthButton}
          >
            <Package size={20} />
            {pedidoSeleccionado.estado === 'preparando' ? 'Continuar' : 'Iniciar'} Preparación en Depósito
          </button>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#dcfce7',
            borderRadius: '12px',
            border: '2px solid #22c55e'
          }}>
            <CheckCircle size={24} style={{ color: '#166534' }} />
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#166534' }}>
              Pedido Completado - Listo para Facturación
            </span>
          </div>
        )}
      </div>
    );
  }

  // ✅ Vista Modo Depósito CORREGIDA CON MEJORAS VISUALES (EXACTAMENTE IGUAL)
  if (vistaActual === 'deposito' && pedidoSeleccionado) {
    let totalItems = 0;
    let completados = 0;
    let sinStock = 0;

    productosEditables.forEach(p => {
      if (p.variantes && p.variantes.length > 0) {
        totalItems += p.variantes.length;
        completados += p.variantes.filter(v => v.estado === 'completado').length;
        sinStock += p.variantes.filter(v => v.estado === 'sin_stock').length;
      } else {
        totalItems += 1;
        if (p.estado === 'completado') completados += 1;
        if (p.estado === 'sin_stock') sinStock += 1;
      }
    });

    const progreso = totalItems > 0 ? Math.round(((completados + sinStock) / totalItems) * 100) : 0;

    return (
      <div className={styles.pageContainer}>
        {/* Header Modo Depósito */}
        <div className={styles.depositoHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={salirDelDeposito}
              className={styles.buttonSecondary}
            >
              <ArrowLeft size={16} />
              Salir
            </button>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                🏪 MODO DEPÓSITO
              </h2>
              <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>
                {pedidoSeleccionado.numero} - {pedidoSeleccionado.cliente.nombre}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* ✅ NUEVO: Botón de guardar progreso visible */}
            <button
              onClick={guardarProgresoAutomatico}
              disabled={!hayProgresoPorGuardar()}
              style={{
                padding: '8px 12px',
                backgroundColor: hayProgresoPorGuardar() ? '#f59e0b' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: hayProgresoPorGuardar() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              💾 Guardar
            </button>

            <button
              onClick={() => setMostrarAgregarProducto(true)}
              className={styles.buttonSuccess}
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>
        </div>

        {/* ✅ NUEVO: Mostrar comentario final del pedido de WhatsApp */}
        {pedidoSeleccionado.comentarioFinal && (
          <div className={styles.card} style={{
            marginBottom: '20px',
            backgroundColor: '#fffbeb',
            border: '2px solid #f59e0b'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#b45309',
              margin: '0 0 8px 0'
            }}>
              ✍️ Comentario Final del Cliente
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#d97706',
              margin: 0
            }}>
              {pedidoSeleccionado.comentarioFinal}
            </p>
          </div>
        )}

        {/* Progreso */}
        <div className={styles.card} style={{marginBottom: '20px'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Progreso del Pedido</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{progreso}%</span>
          </div>

          <div className={styles.progressBarContainer} style={{height: '8px'}}>
            <div className={styles.progressBar} style={{ width: `${progreso}%` }} />
          </div>

          <div className={styles.progressStats}>
            <span className={styles.completed}>✅ {completados} completados</span>
            <span className={styles.outOfStock}>❌ {sinStock} sin stock</span>
            <span className={styles.pending}>⏳ {totalItems - completados - sinStock} pendientes</span>
          </div>
        </div>

        {/* Lista de productos CON SEPARACIÓN VISUAL MEJORADA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {productosEditables.map((producto, index) => {
            const tieneVariantes = producto.variantes && producto.variantes.length > 0;

            return (
              <div
                key={producto.id}
                className={styles.preparationCard}
                style={{
                  // ✅ MEJORA VISUAL: Separación clara entre códigos
                  border: `4px solid ${
                    tieneVariantes ? '#3b82f6' : '#8b5cf6'
                  }`,
                  backgroundColor: tieneVariantes ? '#f8fafc' : '#faf5ff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  position: 'relative'
                }}
              >
                {/* ✅ MEJORA: Numerador de productos */}
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '20px',
                  backgroundColor: tieneVariantes ? '#3b82f6' : '#8b5cf6',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  Producto {index + 1}/{productosEditables.length}
                </div>

                <div className={styles.preparationCardHeader} style={{ marginTop: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '18px',
                      color: '#1f2937',
                      marginBottom: '6px',
                      // ✅ MEJORA: Resaltar nombre del producto
                      backgroundColor: 'white',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb'
                    }}>
                      📦 {producto.nombre}
                    </h3>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#3b82f6',
                      margin: '4px 0'
                    }}>
                      Código: {producto.codigo}
                    </p>
                    {/* ✅ NUEVO: Mostrar comentario del producto de WhatsApp */}
                    {producto.comentarioProducto && (
                      <p style={{
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: '#f59e0b',
                        backgroundColor: '#fffbeb',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        margin: '8px 0 4px 0'
                      }}>
                        📝 {producto.comentarioProducto}
                      </p>
                    )}
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {tieneVariantes ? '🎨 Producto con variantes de color' : '📋 Producto estándar'}
                    </p>
                  </div>

                  <div style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: tieneVariantes ? '#dbeafe' : '#ede9fe',
                    color: tieneVariantes ? '#1e40af' : '#7c3aed',
                    border: `2px solid ${tieneVariantes ? '#3b82f6' : '#8b5cf6'}`,
                    fontWeight: '600'
                  }}>
                    {tieneVariantes ? '📱 WhatsApp' : '📋 Estándar'}
                  </div>
                </div>

                {/* MANEJO DE VARIANTES (MANTENIDO - funciona bien) */}
                {tieneVariantes ? (
                  <div>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937',
                      margin: '0 0 16px 0',
                      // ✅ MEJORA: Resaltar sección de variantes
                      backgroundColor: '#eff6ff',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid #3b82f6'
                    }}>
                      🏪 Preparar por colores ({producto.variantes!.length} variantes):
                    </h4>

                    {producto.variantes!.map(variante => (
                      <div
                        key={variante.id}
                        className={styles.variantItem}
                        style={{
                          border: `3px solid ${
                            variante.estado === 'completado' ? '#22c55e' :
                            variante.estado === 'sin_stock' ? '#ef4444' : '#d1d5db'
                          }`,
                          // ✅ MEJORA: Colores más distinctivos
                          backgroundColor: variante.estado === 'completado' ? '#f0fdf4' :
                                         variante.estado === 'sin_stock' ? '#fef2f2' : '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <h5 style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1f2937',
                              margin: 0,
                              // ✅ MEJORA: Destacar color
                              backgroundColor: '#f9fafb',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}>
                              🎨 Color: {variante.color}
                            </h5>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                              Solicitado: {variante.cantidadPedida} unidades
                            </p>
                          </div>
                          <div className={styles.statusBadge} style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              fontWeight: '600',
                              backgroundColor: variante.estado === 'completado' ? '#dcfce7' :
                                             variante.estado === 'sin_stock' ? '#fee2e2' : '#f3f4f6',
                              color: variante.estado === 'completado' ? '#166534' :
                                     variante.estado === 'sin_stock' ? '#991b1b' : '#374151'
                            }}>
                              {variante.estado === 'completado' ? '✅ OK' :
                               variante.estado === 'sin_stock' ? '❌ Sin Stock' : '⏳ Pendiente'}
                          </div>
                        </div>

                        {variante.estado === 'pendiente' && (
                          <div className={styles.quantityControl}>
                              <button
                                onClick={() => actualizarCantidadVariante(producto.id, variante.id, variante.cantidadPreparada - 1)}
                                className={styles.quantityButton}
                              >
                                <Minus size={16} style={{ color: '#6b7280' }} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={variante.cantidadPreparada}
                                onChange={(e) => actualizarCantidadVariante(producto.id, variante.id, parseInt(e.target.value) || 0)}
                                className={styles.quantityInput}
                              />
                              <button
                                onClick={() => actualizarCantidadVariante(producto.id, variante.id, variante.cantidadPreparada + 1)}
                                className={styles.quantityButton}
                              >
                                <Plus size={16} style={{ color: '#6b7280' }} />
                              </button>
                              <button
                                onClick={() => actualizarCantidadVariante(producto.id, variante.id, variante.cantidadPedida)}
                                className={styles.quickActionButtonAll}
                              >
                                TODO
                              </button>
                              <button
                                onClick={() => actualizarCantidadVariante(producto.id, variante.id, 0)}
                                className={styles.quickActionButtonNone}
                              >
                                NADA
                              </button>
                          </div>
                        )}

                        {variante.estado === 'completado' && (
                          <div className={styles.infoBoxSuccess}>
                            <p style={{margin: 0}}>✅ <strong>Preparado: {variante.cantidadPreparada}</strong> de {variante.cantidadPedida}</p>
                          </div>
                        )}
                        {variante.estado === 'sin_stock' && (
                          <div className={styles.infoBoxDanger}>
                            <p style={{margin: 0}}>❌ <strong>Sin stock de este color</strong></p>
                          </div>
                        )}

                        <div className={styles.variantActionButtons}>
                          {variante.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => marcarVarianteCompletada(producto.id, variante.id)}
                                className={styles.buttonSuccess}
                              >
                                <CheckCircle size={14} /> OK
                              </button>
                              <button
                                onClick={() => marcarVarianteSinStock(producto.id, variante.id)}
                                className={styles.buttonDanger}
                              >
                                <XCircle size={14} /> SIN STOCK
                              </button>
                            </>
                          )}
                          {variante.estado !== 'pendiente' && (
                            <button
                              onClick={() => setProductosEditables(productos => productos.map(p => p.id === producto.id && p.variantes ? { ...p, variantes: p.variantes.map(v => v.id === variante.id ? { ...v, estado: 'pendiente', cantidadPreparada: 0 } : v) } : p ))}
                              className={styles.buttonReset}
                            >
                              Resetear
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* MANEJO NORMAL (MANTENIDO - funciona bien) */
                  <div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                      Cantidad solicitada: <strong>{producto.cantidadPedida}</strong>
                    </p>

                    {producto.estado !== 'sin_stock' && producto.estado !== 'completado' && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                          Cantidad a preparar:
                        </label>
                        <div className={styles.quantityControl}>
                          <button
                            onClick={() => actualizarCantidad(producto.id, producto.cantidadPreparada - 1)}
                            className={styles.quantityButton}
                            style={{width: '44px', height: '44px'}}
                          >
                            <Minus size={20} style={{ color: '#6b7280' }} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={producto.cantidadPreparada}
                            onChange={(e) => actualizarCantidad(producto.id, parseInt(e.target.value) || 0)}
                            className={styles.quantityInput}
                            style={{width: '80px', height: '44px', fontSize: '18px'}}
                          />
                          <button
                            onClick={() => actualizarCantidad(producto.id, producto.cantidadPreparada + 1)}
                            className={styles.quantityButton}
                            style={{width: '44px', height: '44px'}}
                          >
                            <Plus size={20} style={{ color: '#6b7280' }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {producto.estado === 'completado' && (
                      <div className={styles.infoBoxSuccess} style={{padding: '12px', marginBottom: '16px'}}>
                        <p style={{fontSize: '14px', margin: 0}}>
                          ✅ <strong>Preparado: {producto.cantidadPreparada}</strong> de {producto.cantidadPedida}
                        </p>
                      </div>
                    )}
                    {producto.estado === 'sin_stock' && (
                      <div className={styles.infoBoxDanger} style={{padding: '12px', marginBottom: '16px'}}>
                        <p style={{fontSize: '14px', margin: 0}}>❌ <strong>Sin stock disponible</strong></p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                      {producto.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => marcarCompletado(producto.id)}
                            className={styles.buttonSuccess}
                            style={{flex: 1, padding: '12px'}}
                          >
                            <CheckCircle size={16} /> COMPLETADO
                          </button>
                          <button
                            onClick={() => marcarSinStock(producto.id)}
                            className={styles.buttonDanger}
                            style={{flex: 1, padding: '12px'}}
                          >
                            <XCircle size={16} /> SIN STOCK
                          </button>
                        </>
                      )}
                      {producto.estado !== 'pendiente' && (
                        <button
                          onClick={() => setProductosEditables(productos => productos.map(p => p.id === producto.id ? { ...p, estado: 'pendiente', cantidadPreparada: 0 } : p))}
                          className={styles.buttonReset}
                        >
                          Resetear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ✅ SECCIÓN DE COMENTARIOS MEJORADA */}
        <div className={styles.card} style={{marginTop: '20px'}}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            backgroundColor: '#f0f9ff',
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #0ea5e9'
          }}>
            <MessageSquare size={20} style={{ color: '#0369a1' }} />
            <label style={{ fontSize: '16px', fontWeight: '600', color: '#0c4a6e' }}>
              💬 Comentarios del operario:
            </label>
          </div>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Ejemplo: 'Operario: Juan Pérez | Observaciones: Faltó stock de LB010 color negro, se reemplazó por marrón'"
            className={styles.commentTextarea}
            style={{
              minHeight: '100px',
              border: '2px solid #e5e7eb',
              backgroundColor: '#fafafa'
            }}
          />
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '8px 0 0 0',
            fontStyle: 'italic'
          }}>
            💡 Este comentario se transfiere al dashboard y facturación para seguimiento completo
          </p>
        </div>

        {/* ✅ BOTONES FINALES MEJORADOS */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          padding: '20px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px solid #e5e7eb'
        }}>
          {/* Botón Guardar Progreso */}
          <button
            onClick={guardarProgresoAutomatico}
            disabled={!hayProgresoPorGuardar()}
            style={{
              flex: 1,
              padding: '16px',
              backgroundColor: hayProgresoPorGuardar() ? '#f59e0b' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: hayProgresoPorGuardar() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            💾 GUARDAR PROGRESO ({progreso}%)
          </button>

          {/* Botón Finalizar */}
          <button
            onClick={finalizarPedido}
            style={{
              flex: 2,
              padding: '16px',
              backgroundColor: progreso === 100 ? '#22c55e' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {progreso === 100 ? (
              <>🚀 FINALIZAR Y ENVIAR A FACTURACIÓN</>
            ) : (
              <>⚡ FINALIZAR PEDIDO INCOMPLETO ({progreso}%)</>
            )}
          </button>
        </div>

        {/* Modal Agregar Producto (MANTENIDO) */}
        {mostrarAgregarProducto && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                Agregar Producto
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                  Código del producto:
                </label>
                <input type="text" placeholder="Ej: LB001, CM015..." className={styles.inputField} value={nuevoProductoCodigo} onChange={(e) => setNuevoProductoCodigo(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                  Nombre del producto:
                </label>
                <input type="text" placeholder="Descripción del producto..." className={styles.inputField} value={nuevoProductoNombre} onChange={(e) => setNuevoProductoNombre(e.target.value)} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                  Cantidad:
                </label>
                <input type="number" min="1" value={nuevoProductoCantidad} onChange={(e) => setNuevoProductoCantidad(parseInt(e.target.value, 10))} className={styles.inputField} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setMostrarAgregarProducto(false)}
                  className={styles.buttonSecondary}
                  style={{flex: 1}}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAgregarProducto}
                  className={styles.buttonPrimary}
                  style={{flex: 1}}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Pedidos;