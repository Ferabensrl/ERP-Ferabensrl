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
  User,
  Trash2,
  Edit3,
  Search,
  Download
} from 'lucide-react';
import styles from './Pedidos.module.css';
// ✅ ÚNICA ADICIÓN: Import de Supabase
import { supabase, pedidosService, productosService, type DbPedido, type DbPedidoItem } from '../../lib/supabaseClient';
import { jsPDF } from 'jspdf';

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
    // ✅ CORRECCIÓN: 'Surtido' NO es una variante, es un producto normal
    if (item.variante_color &&
        item.variante_color !== 'Sin especificar' &&
        item.variante_color !== 'Surtido') {
      if (!producto.variantes) producto.variantes = [];

      producto.variantes.push({
        id: item.id?.toString() || `${codigo}-${item.variante_color}`,
        color: item.variante_color,
        cantidadPedida: item.cantidad_pedida,
        cantidadPreparada: item.cantidad_preparada,
        estado: item.estado as 'pendiente' | 'completado' | 'sin_stock'
      });
    } else {
      // Producto normal sin variantes (incluye 'Surtido')
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

  // ✅ NUEVOS ESTADOS PARA EDICIÓN EN DETALLE (más seguros)
  const [modoEdicion, setModoEdicion] = useState(false);
  const [buscarProducto, setBuscarProducto] = useState('');
  const [productosEncontrados, setProductosEncontrados] = useState<any[]>([]);
  const [cantidadAAgregar, setCantidadAAgregar] = useState(1);
  const [comentarioProducto, setComentarioProducto] = useState('');

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

  // ✅ NUEVO useEffect para búsqueda automática de productos
  useEffect(() => {
    const timer = setTimeout(() => {
      if (buscarProducto) {
        buscarProductosEnInventario(buscarProducto);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [buscarProducto]);

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
  const iniciarPreparacion = async (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);

    console.log('🔍 DEBUG: Iniciando preparación de pedido', {
      pedidoId: pedido.id,
      numero: pedido.numero,
      estado: pedido.estado,
      productos: pedido.productos
    });

    // ✅ CORRECCIÓN 1: SI ES UN PEDIDO DE SUPABASE Y ESTÁ EN 'PREPARANDO', CARGAR DESDE SUPABASE
    if (pedido.esDeWhatsApp || parseInt(pedido.id) > 0) {
      try {
        console.log('☁️ Cargando datos del pedido desde Supabase...');
        const itemsDB = await pedidosService.getItemsByPedidoId(parseInt(pedido.id));
        console.log('📦 Items cargados desde BD:', itemsDB);

        // Reconstruir productos desde pedido_items
        const productosMap = new Map<string, any>();

        itemsDB.forEach((item: any) => {
          if (!productosMap.has(item.codigo_producto)) {
            // Buscar info del producto en el array original
            const productoInfo = pedido.productos.find((p: any) => p.codigo === item.codigo_producto || p.codigo_producto === item.codigo_producto);

            productosMap.set(item.codigo_producto, {
              id: item.codigo_producto,
              codigo: item.codigo_producto,
              nombre: productoInfo?.nombre || item.codigo_producto,
              cantidadPedida: 0,
              cantidadPreparada: 0,
              precio: item.precio_unitario,
              estado: 'pendiente' as const,
              variantes: []
            });
          }

          const producto = productosMap.get(item.codigo_producto);

          // Si tiene variante_color y NO es 'Surtido', es una variante real
          if (item.variante_color && item.variante_color !== 'Surtido' && item.variante_color !== 'Sin especificar') {
            producto.variantes.push({
              id: `${item.codigo_producto}-${item.variante_color}`,
              color: item.variante_color,
              cantidadPedida: item.cantidad_pedida,
              cantidadPreparada: item.cantidad_preparada,
              estado: item.estado
            });
          } else {
            // Es un producto sin variantes (Surtido)
            producto.cantidadPedida = item.cantidad_pedida;
            producto.cantidadPreparada = item.cantidad_preparada;
            producto.estado = item.estado;
          }
        });

        const productosReconstruidos = Array.from(productosMap.values());
        console.log('✅ Productos reconstruidos desde BD:', productosReconstruidos);

        setProductosEditables(productosReconstruidos);
        setComentarios(pedido.comentarios || '');
        setVistaActual('deposito');
        return; // Salir temprano - ya cargamos desde BD
      } catch (error) {
        console.error('❌ Error cargando desde Supabase, usando datos locales:', error);
        // Continuar con el flujo normal si falla
      }
    }

    // ✅ CORRECCIÓN 2: Intentar cargar progreso guardado LOCAL
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

  // ✅ FUNCIÓN COMPLETAMENTE CORREGIDA: Guardar progreso EN SUPABASE
  const guardarProgresoAutomatico = async () => {
    if (!pedidoSeleccionado) return;

    try {
      console.log('💾 Guardando progreso completo en Supabase...');
      
      // 1. Guardar en localStorage (backup local)
      guardarProgreso(pedidoSeleccionado.id, productosEditables, comentarios);

      // 2. ✅ NUEVO: Preparar datos para Supabase
      const itemsParaActualizar: Array<{
        codigo_producto: string;
        cantidad_preparada: number;
        estado: 'pendiente' | 'completado' | 'sin_stock';
        variante_color?: string;
      }> = [];

      productosEditables.forEach(producto => {
        if (producto.variantes && producto.variantes.length > 0) {
          // Producto con variantes
          producto.variantes.forEach(variante => {
            itemsParaActualizar.push({
              codigo_producto: producto.codigo,
              cantidad_preparada: variante.cantidadPreparada,
              estado: variante.estado,
              variante_color: variante.color
            });
          });
        } else {
          // Producto sin variantes - usar 'Surtido'
          itemsParaActualizar.push({
            codigo_producto: producto.codigo,
            cantidad_preparada: producto.cantidadPreparada,
            estado: producto.estado,
            variante_color: 'Surtido'  // ✅ FIX: Usar 'Surtido' en lugar de ''
          });
        }
      });

      // 3. ✅ ACTUALIZAR EN SUPABASE (no solo estado, sino TODO el progreso)
      if (pedidoSeleccionado.esDeWhatsApp || parseInt(pedidoSeleccionado.id) > 0) {
        await pedidosService.actualizarProgresoPreparacion(
          parseInt(pedidoSeleccionado.id),
          comentarios,
          itemsParaActualizar
        );
        console.log('✅ Progreso guardado en Supabase exitosamente');
      }

      // 4. Actualizar estado en memoria
      setPedidos(pedidos =>
        pedidos.map(p =>
          p.id === pedidoSeleccionado.id
            ? { ...p, estado: 'preparando' }
            : p
        )
      );

      // 5. Volver al dashboard
      if (onVolverDashboard) {
        onVolverDashboard();
      } else {
        setVistaActual('lista');
      }

      alert('✅ PROGRESO GUARDADO COMPLETAMENTE\n\n' +
            '💾 Local: Guardado en el dispositivo\n' +
            '☁️ Supabase: Sincronizado en la nube\n\n' +
            '✅ VISIBLE EN CUALQUIER DISPOSITIVO\n' +
            'Puedes continuar desde cualquier tablet/computadora');

    } catch (error) {
      console.error('❌ Error guardando progreso:', error);
      
      // Fallback: al menos guardar localmente
      setPedidos(pedidos =>
        pedidos.map(p =>
          p.id === pedidoSeleccionado.id
            ? { ...p, estado: 'preparando' }
            : p
        )
      );

      if (onVolverDashboard) {
        onVolverDashboard();
      } else {
        setVistaActual('lista');
      }

      alert('⚠️ PROGRESO GUARDADO SOLO LOCALMENTE\n\n' +
            `Error sincronizando con Supabase: ${error}\n\n` +
            '💾 Se guardó en este dispositivo solamente\n' +
            'Intenta finalizar el pedido desde esta misma tablet');
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
        await guardarProgresoAutomatico();
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

      // 1. Procesar reducción de stock
      const resultadosStock = await productosService.procesarReduccionStockPedido(productosParaReduccionStock);
      console.log('📊 Inventario actualizado:', resultadosStock);

      // 2. ✅ NUEVO: Preparar datos finales para Supabase
      const itemsFinales: Array<{
        codigo_producto: string;
        cantidad_preparada: number;
        estado: 'pendiente' | 'completado' | 'sin_stock';
        variante_color?: string;
      }> = [];

      productosEditables.forEach(producto => {
        if (producto.variantes && producto.variantes.length > 0) {
          producto.variantes.forEach(variante => {
            itemsFinales.push({
              codigo_producto: producto.codigo,
              cantidad_preparada: variante.cantidadPreparada,
              estado: variante.estado,
              variante_color: variante.color
            });
          });
        } else {
          // ✅ CORRECCIÓN: Productos sin variantes usan 'Surtido', NO string vacío
          itemsFinales.push({
            codigo_producto: producto.codigo,
            cantidad_preparada: producto.cantidadPreparada,
            estado: producto.estado,
            variante_color: 'Surtido'
          });
        }
      });

      // 3. ✅ FINALIZAR EN SUPABASE COMPLETAMENTE
      if (pedidoSeleccionado.esDeWhatsApp || parseInt(pedidoSeleccionado.id) > 0) {
        await pedidosService.finalizarPedidoCompleto(
          parseInt(pedidoSeleccionado.id),
          comentarios.trim(),
          itemsFinales
        );
        console.log('✅ Pedido finalizado completamente en Supabase');
      }

      // 4. Crear objeto de pedido finalizado
      const pedidoFinalizado: Pedido = {
        ...pedidoSeleccionado,
        estado: 'completado',
        productos: productosEditables,
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
        `✅ PEDIDO COMPLETADO EXITOSAMENTE\n\n` +
        `📋 ${pedidoFinalizado.numero}\n` +
        `👤 ${pedidoFinalizado.cliente.nombre}\n` +
        `📦 ${totalUnidades} unidades preparadas\n` +
        `📝 ${pedidoFinalizado.productos.length} productos\n` +
        `💰 Total: $${pedidoFinalizado.total?.toLocaleString() || '0'}\n\n` +
        `🏭 INVENTARIO ACTUALIZADO:\n${resumenStock}\n\n` +
        `☁️ SUPABASE: Datos sincronizados\n` +
        `🚀 DISPONIBLE EN FACTURACIÓN\n` +
        `💻 Visible desde cualquier dispositivo`
      );

      if (onVolverDashboard) {
        onVolverDashboard();
      }
      
    } catch (error) {
      console.error('❌ Error finalizando pedido:', error);
      alert(
        `❌ ERROR AL FINALIZAR PEDIDO\n\n` +
        `Error: ${error}\n\n` +
        `⚠️ ACCIONES NECESARIAS:\n` +
        `1. Revisar inventario manualmente\n` +
        `2. Verificar sincronización Supabase\n` +
        `3. Contactar administrador si persiste`
      );
    }
  };

  // ✅ NUEVA FUNCIÓN: Eliminar pedido
  const eliminarPedido = async (pedido: Pedido) => {
    const confirmar = confirm(
      `⚠️ ¿Estás seguro de eliminar este pedido?\n\n` +
      `📋 ${pedido.numero}\n` +
      `👤 ${pedido.cliente.nombre}\n` +
      `📅 ${pedido.fecha}\n\n` +
      `❌ Esta acción no se puede deshacer`
    );

    if (!confirmar) return;

    try {
      console.log('🗑️ Eliminando pedido:', pedido.id);
      
      // Eliminar items del pedido primero (por foreign key)
      const { error: itemsError } = await supabase
        .from('pedido_items')
        .delete()
        .eq('pedido_id', parseInt(pedido.id));

      if (itemsError) {
        console.error('❌ Error eliminando items:', itemsError);
        throw itemsError;
      }

      // Eliminar el pedido principal
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', parseInt(pedido.id));

      if (pedidoError) {
        console.error('❌ Error eliminando pedido:', pedidoError);
        throw pedidoError;
      }

      // Limpiar progreso guardado si existe
      limpiarProgreso(pedido.id);

      // Actualizar estado local - remover el pedido eliminado
      setPedidos(prev => prev.filter(p => p.id !== pedido.id));

      alert(`✅ Pedido eliminado exitosamente\n\n📋 ${pedido.numero} ha sido eliminado del sistema`);
      
    } catch (error) {
      console.error('❌ Error eliminando pedido:', error);
      alert(`❌ Error al eliminar el pedido\n\n${error}`);
    }
  };

  // ============================================
  // FUNCIÓN: Generar y descargar PDF del pedido
  // ============================================
  const handleDescargarPDF = () => {
    if (!pedidoSeleccionado) return;

    try {
      const doc = new jsPDF();

      // Constantes
      const COLOR_PRIMARIO = { r: 143, g: 106, b: 80 };
      const MARGEN = 20;
      const ANCHO_PAGINA = 210;

      let y = MARGEN;

      // Header con logo MARÉ
      doc.setFillColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
      doc.rect(0, 0, ANCHO_PAGINA, 40, 'F');
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('MARÉ', ANCHO_PAGINA / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('By Feraben SRL', ANCHO_PAGINA / 2, 28, { align: 'center' });

      y = 50;

      // Título
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('COMPROBANTE DE PEDIDO', ANCHO_PAGINA / 2, y, { align: 'center' });
      y += 15;

      // Información del pedido
      doc.setFontSize(12);
      doc.setTextColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
      doc.text(`Número: ${pedidoSeleccionado.numero}`, MARGEN, y);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      y += 10;

      const fecha = new Date(pedidoSeleccionado.fecha).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(`Fecha: ${fecha}`, MARGEN, y);
      y += 7;

      doc.setFont(undefined, 'bold');
      doc.text('Cliente:', MARGEN, y);
      doc.setFont(undefined, 'normal');
      doc.text(pedidoSeleccionado.cliente.nombre, MARGEN + 20, y);
      y += 12;

      // Línea separadora
      doc.setDrawColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
      doc.setLineWidth(0.5);
      doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
      y += 10;

      // Detalle de productos
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('DETALLE DEL PEDIDO', MARGEN, y);
      y += 10;

      // Headers de tabla - 6 COLUMNAS (IGUAL QUE PEDIDOS RECIBIDOS + PREPARADA)
      // Código | Producto | Color/Variante | Cant. | Precio Unit. | Preparada
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');

      const colCodigo = MARGEN;                    // 20
      const colProducto = MARGEN + 30;             // 50
      const colColor = MARGEN + 85;                // 105
      const colCantidad = MARGEN + 130;            // 150 (right align)
      const colPrecio = MARGEN + 157;              // 177 (right align)
      const colPreparada = ANCHO_PAGINA - MARGEN;  // 190 (right align)

      doc.text('Código', colCodigo, y);
      doc.text('Producto', colProducto, y);
      doc.text('Color/Variante', colColor, y);
      doc.text('Cant.', colCantidad, y, { align: 'right' });
      doc.text('Precio Unit.', colPrecio, y, { align: 'right' });
      doc.text('Preparada', colPreparada, y, { align: 'right' });

      y += 2;
      doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
      y += 5;

      // Items del pedido
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      const pageHeight = doc.internal.pageSize.height;

      const checkPageBreak = (requiredSpace = 15) => {
        if (y + requiredSpace > pageHeight - MARGEN) {
          doc.addPage();
          y = MARGEN;
          return true;
        }
        return false;
      };

      pedidoSeleccionado.productos.forEach((producto, index) => {
        checkPageBreak(30);

        if (index > 0) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(MARGEN, y - 2, ANCHO_PAGINA - MARGEN, y - 2);
          y += 3;
        }

        // Código del producto
        doc.setFont(undefined, 'bold');
        doc.text(producto.codigo, colCodigo, y);

        // Nombre del producto (truncar si es muy largo)
        const nombreTruncado = producto.nombre.length > 35
          ? producto.nombre.substring(0, 35) + '...'
          : producto.nombre;
        doc.setFont(undefined, 'normal');
        doc.text(nombreTruncado, colProducto, y);

        y += 5;

        // Variantes (colores)
        if (producto.variantes && producto.variantes.length > 0) {
          producto.variantes.forEach((variante) => {
            checkPageBreak(6);

            // Color
            doc.text(`  • ${variante.color}`, colColor, y);

            // Cantidad pedida
            doc.text(variante.cantidadPedida.toString(), colCantidad, y, { align: 'right' });

            // Precio unitario
            const precioUnitario = producto.precio || 0;
            doc.text(`$${precioUnitario.toLocaleString('es-AR')}`, colPrecio, y, { align: 'right' });

            // Cantidad preparada
            doc.setFont(undefined, 'bold');
            doc.text(variante.cantidadPreparada.toString(), colPreparada, y, { align: 'right' });
            doc.setFont(undefined, 'normal');

            y += 5;
          });
        } else {
          // Sin variantes
          const precioUnitario = producto.precio || 0;

          doc.text(producto.cantidadPedida.toString(), colCantidad, y - 5, { align: 'right' });
          doc.text(`$${precioUnitario.toLocaleString('es-AR')}`, colPrecio, y - 5, { align: 'right' });
          doc.setFont(undefined, 'bold');
          doc.text(producto.cantidadPreparada.toString(), colPreparada, y - 5, { align: 'right' });
          doc.setFont(undefined, 'normal');
        }

        // Comentario del producto
        if (producto.comentarioProducto && producto.comentarioProducto.trim() !== '') {
          checkPageBreak(6);
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          doc.text(`    >> ${producto.comentarioProducto.toUpperCase()}`, colProducto, y);
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(8);
          y += 5;
        }

        // Espacio entre productos
        y += 3;
      });

      // Línea separadora final
      checkPageBreak(20);
      y += 5;
      doc.setLineWidth(0.5);
      doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
      y += 10;

      // Comentario final
      if (pedidoSeleccionado.comentarioFinal && pedidoSeleccionado.comentarioFinal.trim() !== '') {
        checkPageBreak(15);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Observaciones:', MARGEN, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);

        // Dividir texto largo en múltiples líneas
        const comentarioLineas = doc.splitTextToSize(
          pedidoSeleccionado.comentarioFinal,
          ANCHO_PAGINA - 2 * MARGEN
        );

        comentarioLineas.forEach((linea: string) => {
          checkPageBreak(6);
          doc.text(linea, MARGEN, y);
          y += 5;
        });

        y += 5;
      }

      // Footer
      const footerY = pageHeight - 15;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont(undefined, 'italic');
      doc.text(
        `Generado desde ERP: ${new Date().toLocaleString('es-AR')}`,
        ANCHO_PAGINA / 2,
        footerY,
        { align: 'center' }
      );

      // Descargar
      const timestamp = Date.now();
      const nombreArchivo = `Pedido_${pedidoSeleccionado.numero}_${timestamp}.pdf`;
      doc.save(nombreArchivo);

      console.log('✅ PDF generado y descargado:', nombreArchivo);
    } catch (err) {
      console.error('❌ Error generando PDF:', err);
      alert(
        '❌ Error al generar el PDF\n\n' +
        'Por favor intenta nuevamente.\n' +
        `Detalle: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    }
  };

  // ✅ NUEVAS FUNCIONES PARA EDITAR PEDIDOS - Solo agregadas, no modifican nada existente
  const buscarProductosEnInventario = async (codigo: string) => {
    if (!codigo.trim()) {
      setProductosEncontrados([]);
      return;
    }

    try {
      console.log('🔍 Buscando productos con código:', codigo);
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .ilike('codigo_producto', `%${codigo}%`)
        .eq('activo', true)
        .limit(10);

      if (error) throw error;

      console.log('📦 Productos encontrados:', data);
      setProductosEncontrados(data || []);
    } catch (error) {
      console.error('❌ Error buscando productos:', error);
      setProductosEncontrados([]);
    }
  };

  const agregarProductoAPedido = (productoInventario: any) => {
    if (!pedidoParaEditar) return;

    const nuevoProducto: Producto = {
      id: `producto-${Date.now()}`,
      codigo: productoInventario.codigo_producto,
      nombre: productoInventario.nombre || 'Producto sin nombre',
      cantidadPedida: cantidadAAgregar,
      cantidadPreparada: 0,
      estado: 'pendiente',
      precio: productoInventario.precio_venta || 0
    };

    // Actualizar el pedido seleccionado
    const pedidoActualizado = {
      ...pedidoParaEditar,
      productos: [...pedidoParaEditar.productos, nuevoProducto]
    };

    // Actualizar en la lista de pedidos
    setPedidos(prev => prev.map(p => 
      p.id === pedidoParaEditar.id ? pedidoActualizado : p
    ));

    setPedidoParaEditar(pedidoActualizado);
    
    // Limpiar búsqueda
    setBuscarProducto('');
    setProductosEncontrados([]);
    setCantidadAAgregar(1);

    alert(`✅ Producto agregado: ${productoInventario.codigo_producto} x${cantidadAAgregar}`);
  };

  const eliminarProductoDePedido = (productoId: string) => {
    if (!pedidoParaEditar) return;

    const pedidoActualizado = {
      ...pedidoParaEditar,
      productos: pedidoParaEditar.productos.filter(p => p.id !== productoId)
    };

    setPedidos(prev => prev.map(p => 
      p.id === pedidoParaEditar.id ? pedidoActualizado : p
    ));

    setPedidoParaEditar(pedidoActualizado);
    alert('✅ Producto eliminado del pedido');
  };

  const modificarCantidadProducto = (productoId: string, nuevaCantidad: number) => {
    if (!pedidoParaEditar || nuevaCantidad < 0) return;

    const pedidoActualizado = {
      ...pedidoParaEditar,
      productos: pedidoParaEditar.productos.map(p => 
        p.id === productoId ? { ...p, cantidadPedida: nuevaCantidad } : p
      )
    };

    setPedidos(prev => prev.map(p => 
      p.id === pedidoParaEditar.id ? pedidoActualizado : p
    ));

    setPedidoParaEditar(pedidoActualizado);
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
                      {pedido.cliente.nombre}
                    </h3>
                    <div className={styles.clientInfo}>
                      <User size={16} />
                      <span>{pedido.numero}</span>
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

                  {(pedido.estado === 'preparando' || (pedido.estado === 'pendiente' && progreso > 0)) && (
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
                        {/* ✅ MOSTRAR comentario en vista lista */}
                        {producto.comentario && (
                          <span style={{ color: '#059669', fontSize: '12px', fontStyle: 'italic' }}>
                            {' '}💬{producto.comentario}
                          </span>
                        )}
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

                  {/* ✅ NUEVO: Botón eliminar - disponible para todos los estados */}
                  <button
                    onClick={() => eliminarPedido(pedido)}
                    className={styles.buttonSecondary}
                    style={{
                      backgroundColor: '#fee2e2', 
                      borderColor: '#fca5a5',
                      color: '#dc2626'
                    }}
                    title="Eliminar pedido"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </button>
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

          {/* ✅ BOTÓN DESCARGAR PDF */}
          <button
            onClick={handleDescargarPDF}
            className={styles.buttonSuccess}
            title="Descargar comprobante en PDF"
          >
            <Download size={16} />
            Descargar PDF
          </button>

          {/* ✅ BOTÓN EDITAR SEGURO - En vista detalle estable */}
          <button
            onClick={() => setModoEdicion(!modoEdicion)}
            className={modoEdicion ? styles.buttonDanger : styles.buttonPrimary}
          >
            <Edit3 size={16} />
            {modoEdicion ? 'Cancelar Edición' : 'Editar Pedido'}
          </button>

          {/* ✅ BOTÓN GUARDAR - Solo en modo edición */}
          {modoEdicion && (
            <button
              onClick={async () => {
                try {
                  console.log('💾 Guardando cambios en Supabase...');
                  
                  await pedidosService.actualizarProductosPedido(
                    parseInt(pedidoSeleccionado.id),
                    pedidoSeleccionado.productos
                  );
                  
                  alert('✅ Cambios guardados exitosamente en Supabase');
                  setModoEdicion(false);
                } catch (error) {
                  console.error('❌ Error guardando:', error);
                  alert('❌ Error guardando cambios. Intenta nuevamente.');
                }
              }}
              className={styles.buttonSuccess}
              style={{ backgroundColor: '#10b981' }}
            >
              <CheckCircle size={16} />
              Guardar Cambios
            </button>
          )}

          <div>
            <h2 className={styles.pageTitle} style={{fontSize: '24px', marginBottom: 0}}>
              {pedidoSeleccionado.cliente.nombre}
            </h2>
            <p className={styles.pageSubtitle}>{pedidoSeleccionado.numero}</p>
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
                  {/* ✅ MOSTRAR comentario si existe */}
                  {producto.comentario && (
                    <p style={{ fontSize: '14px', color: '#059669', fontStyle: 'italic' }}>
                      💬 {producto.comentario}
                    </p>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  {modoEdicion ? (
                    // ✅ MODO EDICIÓN: Botones para modificar cantidad
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          // ✅ PERMITIR cantidad 0 para eliminar producto
                          const nuevaCantidad = producto.cantidadPedida - 1;
                          if (nuevaCantidad === 0) {
                            // Eliminar producto si cantidad es 0
                            const pedidoActualizado = {
                              ...pedidoSeleccionado,
                              productos: pedidoSeleccionado.productos.filter(p => p.id !== producto.id)
                            };
                            setPedidos(prev => prev.map(p => 
                              p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                            ));
                            setPedidoSeleccionado(pedidoActualizado);
                          } else if (nuevaCantidad > 0) {
                            // Modificar cantidad normalmente
                            const pedidoActualizado = {
                              ...pedidoSeleccionado,
                              productos: pedidoSeleccionado.productos.map(p => 
                                p.id === producto.id ? { ...p, cantidadPedida: nuevaCantidad } : p
                              )
                            };
                            setPedidos(prev => prev.map(p => 
                              p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                            ));
                            setPedidoSeleccionado(pedidoActualizado);
                          }
                        }}
                        className={styles.quantityButton}
                        disabled={producto.cantidadPedida <= 0}
                      >
                        <Minus size={14} />
                      </button>
                      
                      <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                        {producto.cantidadPedida}
                      </span>
                      
                      <button
                        onClick={() => {
                          // Modificar cantidad del producto
                          const nuevaCantidad = producto.cantidadPedida + 1;
                          const pedidoActualizado = {
                            ...pedidoSeleccionado,
                            productos: pedidoSeleccionado.productos.map(p => 
                              p.id === producto.id ? { ...p, cantidadPedida: nuevaCantidad } : p
                            )
                          };
                          setPedidos(prev => prev.map(p => 
                            p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                          ));
                          setPedidoSeleccionado(pedidoActualizado);
                        }}
                        className={styles.quantityButton}
                      >
                        <Plus size={14} />
                      </button>
                      
                      <button
                        onClick={() => {
                          // ✅ EDITAR COMENTARIO/VARIANTES del producto
                          const nuevoComentario = prompt(
                            `Editar comentario para ${producto.nombre}:\n(ej: 3 negro, 2 azul, 1 rojo)`,
                            producto.comentario || ''
                          );
                          
                          if (nuevoComentario !== null) {
                            const pedidoActualizado = {
                              ...pedidoSeleccionado,
                              productos: pedidoSeleccionado.productos.map(p => 
                                p.id === producto.id ? { ...p, comentario: nuevoComentario } : p
                              )
                            };
                            setPedidos(prev => prev.map(p => 
                              p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                            ));
                            setPedidoSeleccionado(pedidoActualizado);
                          }
                        }}
                        className={styles.buttonSecondary}
                        style={{ marginLeft: '8px', padding: '4px', backgroundColor: '#f3f4f6' }}
                        title="Editar comentario/colores"
                      >
                        <MessageSquare size={14} />
                      </button>
                      
                      <button
                        onClick={() => {
                          // Eliminar producto del pedido
                          if (confirm(`¿Eliminar ${producto.nombre} del pedido?`)) {
                            const pedidoActualizado = {
                              ...pedidoSeleccionado,
                              productos: pedidoSeleccionado.productos.filter(p => p.id !== producto.id)
                            };
                            setPedidos(prev => prev.map(p => 
                              p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                            ));
                            setPedidoSeleccionado(pedidoActualizado);
                          }
                        }}
                        className={styles.buttonDanger}
                        style={{ marginLeft: '8px', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    // ✅ MODO NORMAL: Solo mostrar info
                    <>
                      <p><strong>{producto.cantidadPedida}</strong> unidades</p>
                      {producto.precio && (
                        <p>${producto.precio.toLocaleString()} c/u</p>
                      )}
                    </>
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

          {/* ✅ BUSCADOR DE PRODUCTOS - Solo en modo edición */}
          {modoEdicion && (
            <div style={{ 
              marginTop: '20px', 
              padding: '16px', 
              border: '2px dashed #e5e7eb', 
              borderRadius: '8px',
              backgroundColor: '#f9fafb'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
                ➕ Agregar Producto al Pedido
              </h4>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Buscar por código de producto..."
                  value={buscarProducto}
                  onChange={(e) => setBuscarProducto(e.target.value)}
                  className={styles.input}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min="1"
                  value={cantidadAAgregar}
                  onChange={(e) => setCantidadAAgregar(Number(e.target.value))}
                  className={styles.input}
                  style={{ width: '70px' }}
                  placeholder="Cant."
                />
              </div>
              
              {/* ✅ CAMPO COMENTARIO para especificar colores/variantes */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Comentario opcional (ej: 3 negro, 2 azul, 1 rojo)..."
                  value={comentarioProducto}
                  onChange={(e) => setComentarioProducto(e.target.value)}
                  className={styles.input}
                  style={{ width: '100%' }}
                />
              </div>
              
              {/* Resultados de búsqueda */}
              {productosEncontrados.length > 0 && (
                <div style={{ 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px', 
                  backgroundColor: 'white',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {productosEncontrados.map((producto) => (
                    <div
                      key={producto.id}
                      onClick={() => {
                        // ✅ Agregar producto al pedido con comentario
                        const nuevoProducto: Producto = {
                          id: `producto-${Date.now()}`,
                          codigo: producto.codigo_producto,
                          nombre: producto.nombre || 'Sin nombre',
                          cantidadPedida: cantidadAAgregar,
                          cantidadPreparada: 0,
                          estado: 'pendiente',
                          precio: producto.precio_venta || 0,
                          comentario: comentarioProducto // ✅ Incluir comentario para colores/variantes
                        };

                        const pedidoActualizado = {
                          ...pedidoSeleccionado,
                          productos: [...pedidoSeleccionado.productos, nuevoProducto]
                        };

                        setPedidos(prev => prev.map(p => 
                          p.id === pedidoSeleccionado.id ? pedidoActualizado : p
                        ));
                        setPedidoSeleccionado(pedidoActualizado);
                        
                        // ✅ Limpiar búsqueda y comentario
                        setBuscarProducto('');
                        setProductosEncontrados([]);
                        setCantidadAAgregar(1);
                        setComentarioProducto('');
                        
                        const mensajeComentario = comentarioProducto ? ` (${comentarioProducto})` : '';
                        alert(`✅ ${producto.codigo_producto} agregado al pedido (${cantidadAAgregar} unidades)${mensajeComentario}`);
                      }}
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div>
                        <strong>{producto.codigo_producto}</strong>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>{producto.nombre}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold' }}>${producto.precio_venta}</div>
                        <div style={{ fontSize: '12px', color: '#10b981' }}>Click para agregar</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                {pedidoSeleccionado.cliente.nombre} - {pedidoSeleccionado.numero}
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