import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  FileText, 
  Download, 
  Eye,
  Percent,
  DollarSign,
  CheckSquare,
  Square,
  AlertCircle,
  Check,
  ArrowLeft,
  Calculator,
  Edit3,
  Clock,
  Package,
  User,
  ShoppingCart,
  MessageSquare,
  RefreshCw,
  Trash2,
  Archive,
  Upload,
  Plus,
  Minus
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ✅ TIPOS CORREGIDOS para evitar duplicados y undefined
interface VarianteProductoFacturacion {
  id: string;
  color: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
}

interface ProductoFacturacion {
  id: string;
  codigo: string;
  nombre: string;
  cantidad: number; // Cantidad TOTAL (suma de variantes PREPARADAS)
  precioUnitario: number;
  descuentoPorcentaje: number;
  codigoBarras?: string;
  comentarioProducto?: string;
  variantes?: VarianteProductoFacturacion[];
  productoBase?: string;
  cantidadPreparada?: number;
  cantidadOriginalPreparada?: number; // ✅ CANTIDAD ORIGINAL PARA CALCULAR DIFERENCIAS
  descripcion?: string; // ✅ AGREGAR ESTO
}

interface ClienteFacturacion {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
}

interface PedidoParaFacturar {
  id: string;
  numero: string;
  cliente: ClienteFacturacion;
  fecha: string;
  estado: 'completado';
  productos: ProductoFacturacion[];
  total: number;
  seleccionado: boolean;
  comentarios?: string;
  comentarioFinal?: string;
  fechaCompletado?: string;
  esDeWhatsApp?: boolean;
  yaFacturado?: boolean;
}

interface FacturaHistorica {
  id: string;
  fecha: string;
  pedidos: PedidoParaFacturar[];
  total: number;
  nombreArchivo: string;
}

interface FacturacionProps {
  pedidosCompletados?: any[];
  pedidosWhatsApp?: any[];
}
// ✅ COMPONENTE PRINCIPAL COMPLETAMENTE CORREGIDO
const Facturacion: React.FC<FacturacionProps> = ({
  pedidosCompletados = [], 
  pedidosWhatsApp = [] 
}) => {
  // Estados principales
  const [pedidosListos, setPedidosListos] = useState<PedidoParaFacturar[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
  const [vistaActual, setVistaActual] = useState<'lista' | 'configurar' | 'preview' | 'historial'>('lista');
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<PedidoParaFacturar[]>([]);
  const [generandoExcel, setGenerandoExcel] = useState(false);
  const [historialFacturacion, setHistorialFacturacion] = useState<FacturaHistorica[]>([]);
  const [estadisticas, setEstadisticas] = useState({
    totalPedidos: 0,
    totalFacturacion: 0,
    pedidosWhatsApp: 0,
    pedidosEstandar: 0
  });
  const [pedidosProcesados, setPedidosProcesados] = useState<Set<string>>(new Set());
  const inputFileRef = useRef<HTMLInputElement>(null);

  // ✅ NUEVA FUNCIÓN: Cargar pedidos completados directamente desde Supabase
  const cargarPedidosCompletadosDeSupabase = async () => {
    try {
      console.log('📊 Facturación: Cargando pedidos completados desde Supabase...');

      // Obtener pedidos completados (listos para facturar)
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'completado')
        .order('fecha_completado', { ascending: false });

      if (pedidosError) {
        console.error('❌ Error obteniendo pedidos completados:', pedidosError);
        return [];
      }

      console.log('✅ Pedidos completados obtenidos de Supabase:', pedidosData?.length || 0);

      // Para cada pedido, obtener sus items y convertir al formato de facturación
      const pedidosParaFacturar: any[] = [];
      
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

        // Obtener datos de inventario para nombres y códigos de barras
        const codigosUnicos = [...new Set(itemsData?.map(item => item.codigo_producto) || [])];
        const { data: datosInventario } = await supabase
          .from('inventario')
          .select('codigo_producto, descripcion, codigo_barras')
          .in('codigo_producto', codigosUnicos);

        const inventarioMap = new Map();
        datosInventario?.forEach(item => {
          inventarioMap.set(item.codigo_producto, item);
        });

        // Convertir pedido al formato esperado por facturación
        const pedidoConvertido = {
          ...pedido,
          cliente: {
            id: `cliente-${pedido.id}`,
            nombre: pedido.cliente_nombre,
            telefono: pedido.cliente_telefono || '',
            direccion: pedido.cliente_direccion || ''
          },
          fecha: new Date(pedido.fecha_pedido).toISOString().split('T')[0],
          productos: itemsData?.map((item: any) => {
            const datosInv = inventarioMap.get(item.codigo_producto);
            return {
              id: item.id?.toString() || `item-${Math.random()}`,
              codigo: item.codigo_producto,
              nombre: datosInv?.descripcion || `Producto ${item.codigo_producto}`,
              cantidadPedida: item.cantidad_pedida,
              cantidadPreparada: item.cantidad_preparada,
              estado: item.estado,
              precio: item.precio_unitario,
              codigoBarras: datosInv?.codigo_barras || '',
              variante_color: item.variante_color,
              comentarios: item.comentarios
            };
          }) || [],
          comentarios: pedido.comentarios || '',
          esDeWhatsApp: pedido.origen === 'whatsapp'
        };

        pedidosParaFacturar.push(pedidoConvertido);
      }

      return pedidosParaFacturar;

    } catch (error) {
      console.error('❌ Error cargando pedidos completados de Supabase:', error);
      return [];
    }
  };

  // ✅ EFECTO PRINCIPAL MODIFICADO: Consultar Supabase directamente
  useEffect(() => {
    const cargarTodosLosPedidos = async () => {
      console.log('📊 Facturación: Iniciando carga de pedidos...');

      // Cargar pedidos completados desde Supabase
      const pedidosDeSupabase = await cargarPedidosCompletadosDeSupabase();
      console.log('📦 Pedidos completados de Supabase:', pedidosDeSupabase.length);

      // También procesar pedidos recibidos por props (para compatibilidad)
      const idsYaProcesados = new Set<string>();
      const pedidosUnicos: any[] = [];

      // ✅ SOLO agregar pedidos de Supabase (fuente única de verdad)
      pedidosDeSupabase.forEach(pedido => {
        const idNormalizado = String(pedido.id); // Normalizar a string
        if (pedido && pedido.id && !idsYaProcesados.has(idNormalizado)) {
          idsYaProcesados.add(idNormalizado);
          pedidosUnicos.push(pedido);
        }
      });

      // ❌ DESHABILITADO: Props tenían datos desactualizados (cantidad_pedida en lugar de cantidad_preparada)
      // Antes se combinaban pedidos de Supabase + props, pero props contenían:
      // - Cantidades PEDIDAS (no preparadas)
      // - Productos sin stock aparecían con cantidades completas
      // - Total calculado incorrectamente
      // Ahora SOLO usamos Supabase que tiene los datos reales después de preparación
      /*
      [...pedidosCompletados, ...pedidosWhatsApp].forEach(pedido => {
        const idNormalizado = String(pedido.id);
        if (pedido && pedido.id && !idsYaProcesados.has(idNormalizado) && pedido.estado === 'completado') {
          idsYaProcesados.add(idNormalizado);
          pedidosUnicos.push(pedido);
        }
      });
      */

      console.log('✅ Pedidos únicos después de filtrar:', pedidosUnicos.length);

      // ✅ CORRECCIÓN 2: Convertir solo pedidos completados
      const pedidosParaFacturar: PedidoParaFacturar[] = pedidosUnicos
        .filter(pedido => pedido && pedido.estado === 'completado')
        .map(pedido => {
          const esDeWhatsApp = Boolean(pedido.esDeWhatsApp || pedido.origen === 'whatsapp');
          
          return {
            id: pedido.id,
            numero: pedido.numero || `PED-${pedido.id}`,
            cliente: pedido.cliente || {
              id: pedido.cliente?.id || `cliente-${pedido.id}`,
              nombre: pedido.cliente?.nombre || pedido.cliente_nombre || 'Cliente no especificado',
              telefono: pedido.cliente?.telefono || pedido.cliente_telefono,
              direccion: pedido.cliente?.direccion || pedido.cliente_direccion
            },
            fecha: pedido.fecha || new Date().toISOString().split('T')[0],
            estado: 'completado' as const,
            productos: pedido.productos?.map((producto: any) => {
              // ✅ CORRECCIÓN 4: Calcular cantidad TOTAL sumando variantes PREPARADAS
              const cantidadTotal = producto.variantes && producto.variantes.length > 0
                ? producto.variantes.reduce((sum: number, v: any) => sum + (v.cantidadPreparada || 0), 0)
                : (producto.cantidadPreparada !== undefined && producto.cantidadPreparada !== null
                    ? producto.cantidadPreparada
                    : producto.cantidadPedida || 0);

              return {
                id: producto.id || `prod-${Math.random().toString(36).substr(2, 9)}`,
                codigo: producto.codigo || 'SIN_CODIGO',
                nombre: producto.nombre || 'Producto sin nombre',
                cantidad: cantidadTotal,
                precioUnitario: producto.precio || producto.precio_unitario || 0,
                descuentoPorcentaje: 0,
                codigoBarras: producto.codigoBarras || producto.codigo || `cb-${producto.id}`,
                comentarioProducto: producto.comentarioProducto,
                descripcion: producto.descripcion || producto.nombre,
                variantes: producto.variantes ? 
                  producto.variantes.map((v: any) => ({
                    id: v.id || `var_${Math.random().toString(36).substr(2, 9)}`,
                    color: v.color || 'Sin color',
                    cantidadPedida: v.cantidadPedida || 0,
                    cantidadPreparada: v.cantidadPreparada || 0,
                    estado: v.estado || 'pendiente'
                  }))
                : undefined,
                productoBase: producto.productoBase,
                cantidadPreparada: cantidadTotal, // ✅ CANTIDAD ORIGINAL PREPARADA EN DEPÓSITO
                cantidadOriginalPreparada: cantidadTotal // ✅ BACKUP para cálculo de diferencias
              };
            }),
            // ✅ CORRECCIÓN 3: Calcular total real basado en cantidades preparadas
            total: (() => {
              return pedido.productos?.reduce((sum: number, prod: any) => {
                const cantidadReal = prod.variantes && prod.variantes.length > 0
                  ? prod.variantes.reduce((vSum: number, v: any) => vSum + (v.cantidadPreparada || 0), 0)
                  : (prod.cantidadPreparada !== undefined && prod.cantidadPreparada !== null
                      ? prod.cantidadPreparada
                      : prod.cantidadPedida || 0);
                return sum + (cantidadReal * (prod.precio || prod.precio_unitario || 0));
              }, 0) || pedido.total || 0;
            })(),
            seleccionado: false,
            comentarios: pedido.comentarios || '',
            comentarioFinal: pedido.comentarioFinal,
            fechaCompletado: pedido.fechaCompletado || pedido.fecha_completado,
            esDeWhatsApp: esDeWhatsApp,
            yaFacturado: false
          };
        });

      // ✅ CORRECCIÓN 6: Filtrar pedidos ya facturados
      const pedidosNoFacturados = pedidosParaFacturar.filter(p => !pedidosProcesados.has(p.id));
      
      setPedidosListos(pedidosNoFacturados);

      // Actualizar estadísticas
      const stats = {
        totalPedidos: pedidosNoFacturados.length,
        totalFacturacion: pedidosNoFacturados.reduce((sum, p) => sum + p.total, 0),
        pedidosWhatsApp: pedidosNoFacturados.filter(p => p.esDeWhatsApp).length,
        pedidosEstandar: pedidosNoFacturados.filter(p => !p.esDeWhatsApp).length
      };
      setEstadisticas(stats);

      console.log('✅ Pedidos listos para facturación:', pedidosNoFacturados.length);

      // Cargar historial de facturación desde localStorage
      const historialGuardado = localStorage.getItem('historialFacturacion');
      if (historialGuardado) {
        setHistorialFacturacion(JSON.parse(historialGuardado));
      }
    };

    cargarTodosLosPedidos();
  }, [pedidosCompletados, pedidosWhatsApp, pedidosProcesados]);
  // ✅ FUNCIONES DE MANEJO MEJORADAS
  const handleImportarExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('📊 Datos importados:', jsonData);
        alert(`✅ Archivo Excel importado: ${jsonData.length} registros`);
        
      } catch (error) {
        console.error('❌ Error importando Excel:', error);
        alert('❌ Error al importar el archivo Excel');
      }
    };
    
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const seleccionarPedido = (pedidoId: string) => {
    setPedidosListos(pedidos =>
      pedidos.map(p =>
        p.id === pedidoId ? { ...p, seleccionado: !p.seleccionado } : p
      )
    );
  };

  const seleccionarTodos = () => {
    const todosSeleccionados = pedidosListos.every(p => p.seleccionado);
    setPedidosListos(pedidos =>
      pedidos.map(p => ({ ...p, seleccionado: !todosSeleccionados }))
    );
  };

  const configurarFacturacion = () => {
    const seleccionados = pedidosListos.filter(p => p.seleccionado);
    
    if (seleccionados.length === 0) {
      alert('⚠️ Selecciona al menos un pedido para facturar');
      return;
    }

    setPedidosSeleccionados(seleccionados);
    setVistaActual('configurar');
  };

  // ✅ NUEVA FUNCIÓN: Editar cantidad de producto CON AJUSTE DE INVENTARIO
  const editarCantidadProducto = async (pedidoId: string, productoId: string, nuevaCantidad: number) => {
    // Encontrar el producto y su cantidad original preparada
    const pedido = pedidosSeleccionados.find(p => p.id === pedidoId);
    const producto = pedido?.productos.find(p => p.id === productoId);
    
    if (!producto) {
      console.error('❌ Producto no encontrado para ajuste de inventario');
      return;
    }

    const cantidadOriginalPreparada = producto.cantidadOriginalPreparada || producto.cantidadPreparada || producto.cantidad;
    const nuevaCantidadFinal = Math.max(0, nuevaCantidad);
    const diferencia = cantidadOriginalPreparada - nuevaCantidadFinal;

    console.log(`🔄 Ajustando inventario: ${producto.codigo}`);
    console.log(`   • Cantidad original preparada: ${cantidadOriginalPreparada}`);
    console.log(`   • Nueva cantidad a facturar: ${nuevaCantidadFinal}`);
    console.log(`   • Diferencia a devolver al stock: ${diferencia}`);

    // Actualizar el estado local primero
    setPedidosSeleccionados(pedidos =>
      pedidos.map(pedido =>
        pedido.id === pedidoId
          ? {
              ...pedido,
              productos: pedido.productos.map(prod =>
                prod.id === productoId
                  ? { ...prod, cantidad: nuevaCantidadFinal }
                  : prod
              )
            }
          : pedido
      )
    );

    // Si hay diferencia positiva, devolver stock al inventario
    if (diferencia > 0) {
      try {
        // Importar productosService desde supabaseClient
        const { productosService } = await import('../../lib/supabaseClient');
        
        // Buscar el producto en inventario por código
        const productoEnInventario = await productosService.getByCodigo(producto.codigo);
        
        if (productoEnInventario) {
          // Devolver la diferencia al stock
          const nuevoStock = productoEnInventario.stock + diferencia;
          await productosService.updateStock(productoEnInventario.id, nuevoStock);
          
          console.log(`✅ Stock devuelto: ${producto.codigo} | ${productoEnInventario.stock} → ${nuevoStock} (+${diferencia})`);
          
          // Mostrar notificación al usuario
          alert(`✅ Stock ajustado: ${producto.codigo}\n📦 Se devolvieron ${diferencia} unidades al inventario\n📊 Stock actual: ${nuevoStock}`);
        } else {
          console.warn(`⚠️ Producto ${producto.codigo} no encontrado en inventario`);
          alert(`⚠️ No se pudo ajustar el stock de ${producto.codigo} (producto no encontrado en inventario)`);
        }
      } catch (error) {
        console.error('❌ Error ajustando stock:', error);
        alert(`❌ Error al ajustar el stock de ${producto.codigo}`);
      }
    } else if (diferencia < 0) {
      // Si la diferencia es negativa (se quiere facturar más de lo preparado)
      const cantidadExceso = Math.abs(diferencia);
      console.warn(`⚠️ Se intenta facturar ${cantidadExceso} unidades más de las preparadas para ${producto.codigo}`);
      alert(`⚠️ Atención: Se está facturando ${cantidadExceso} unidades más de las preparadas para ${producto.codigo}`);
    }
  };

  // ✅ NUEVA FUNCIÓN: Editar precio de producto
  const editarPrecioProducto = (pedidoId: string, productoId: string, nuevoPrecio: number) => {
    setPedidosSeleccionados(pedidos =>
      pedidos.map(pedido =>
        pedido.id === pedidoId
          ? {
              ...pedido,
              productos: pedido.productos.map(prod =>
                prod.id === productoId
                  ? { ...prod, precioUnitario: Math.max(0, nuevoPrecio) }
                  : prod
              )
            }
          : pedido
      )
    );
  };

  const editarDescuentoProducto = (pedidoId: string, productoId: string, nuevoDescuento: number) => {
    setPedidosSeleccionados(pedidos =>
      pedidos.map(pedido =>
        pedido.id === pedidoId
          ? {
              ...pedido,
              productos: pedido.productos.map(prod =>
                prod.id === productoId
                  ? { ...prod, descuentoPorcentaje: Math.max(0, Math.min(100, nuevoDescuento)) }
                  : prod
              )
            }
          : pedido
      )
    );
  };
  // ✅ NUEVA FUNCIÓN: Agregar producto manualmente
  const agregarProductoManual = (pedidoId: string) => {
    const codigo = prompt('Código del producto:');
    if (!codigo?.trim()) {
      alert('⚠️ El código del producto es obligatorio');
      return;
    }

    const nombre = prompt('Nombre del producto:');
    if (!nombre?.trim()) {
      alert('⚠️ El nombre del producto es obligatorio');
      return;
    }

    const cantidadStr = prompt('Cantidad:');
    const cantidad = parseFloat(cantidadStr || '0');
    if (cantidad <= 0) {
      alert('⚠️ La cantidad debe ser mayor a 0');
      return;
    }

    const precioStr = prompt('Precio unitario:');
    const precio = parseFloat(precioStr || '0');
    if (precio <= 0) {
      alert('⚠️ El precio debe ser mayor a 0');
      return;
    }

    const nuevoProducto: ProductoFacturacion = {
      id: `manual-${Date.now()}`,
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      cantidad: cantidad,
      precioUnitario: precio,
      descuentoPorcentaje: 0,
      codigoBarras: `manual-${Date.now()}`
    };

    setPedidosSeleccionados(pedidos =>
      pedidos.map(pedido =>
        pedido.id === pedidoId
          ? { ...pedido, productos: [...pedido.productos, nuevoProducto] }
          : pedido
      )
    );

    alert('✅ Producto agregado correctamente');
  };

  // ✅ NUEVA FUNCIÓN: Remover producto
  const removerProducto = (pedidoId: string, productoId: string) => {
    const confirmar = confirm('¿Estás seguro de que deseas eliminar este producto?');
    
    if (confirmar) {
      setPedidosSeleccionados(pedidos =>
        pedidos.map(pedido =>
          pedido.id === pedidoId
            ? {
                ...pedido,
                productos: pedido.productos.filter(prod => prod.id !== productoId)
              }
            : pedido
        )
      );
    }
  };

  // Aplicar descuento global
  const aplicarDescuentoGlobal = () => {
    if (descuentoGlobal < 0 || descuentoGlobal > 100) {
      alert('⚠️ El descuento debe estar entre 0% y 100%');
      return;
    }
    
    setPedidosSeleccionados(pedidos =>
      pedidos.map(pedido => ({
        ...pedido,
        productos: pedido.productos.map(prod => ({
          ...prod,
          descuentoPorcentaje: descuentoGlobal
        }))
      }))
    );
    
    alert(`✅ Descuento del ${descuentoGlobal}% aplicado a todos los productos`);
  };

  // Calcular precio con descuento
  const calcularPrecioConDescuento = (precio: number, descuento: number) => {
    return precio * (1 - descuento / 100);
  };

  // Calcular total con descuentos
  const calcularTotalConDescuentos = () => {
    return pedidosSeleccionados.reduce((total, pedido) => {
      return total + pedido.productos.reduce((subtotal, producto) => {
        const precioConDescuento = calcularPrecioConDescuento(producto.precioUnitario, producto.descuentoPorcentaje);
        return subtotal + (precioConDescuento * producto.cantidad);
      }, 0);
    }, 0);
  };

  const verPreview = () => {
    setVistaActual('preview');
  };
  // ✅ FUNCIÓN PRINCIPAL CORREGIDA: Generar Excel con códigos de barras
  const generarExcel = async () => {
    setGenerandoExcel(true);

    try {
      // ✅ CORRECCIÓN: Agrupar productos por código para evitar duplicados
const productosAgrupados = new Map<string, {
  codigo: string;
  nombre: string;
  descripcion: string; // ✅ AGREGAR ESTE CAMPO
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  codigoBarras: string;
}>();

      // Procesar todos los pedidos seleccionados
      pedidosSeleccionados.forEach(pedido => {
        pedido.productos.forEach(producto => {
          const key = producto.codigo;
          
          if (productosAgrupados.has(key)) {
            // Producto ya existe: sumar cantidad
            const existente = productosAgrupados.get(key)!;
            existente.cantidad += producto.cantidad;
          } else {
            // Nuevo producto
productosAgrupados.set(key, {
  codigo: producto.codigo,
  nombre: producto.nombre,
  descripcion: producto.descripcion || producto.nombre,
  cantidad: producto.cantidad,
  precioUnitario: producto.precioUnitario,
  descuentoPorcentaje: producto.descuentoPorcentaje,
  codigoBarras: producto.codigoBarras || ''
});
          }
        });
      });

      // ✅ CORRECCIÓN PROBLEMA 4: Usar código de barras en columna Descripcion
const datosExcel = Array.from(productosAgrupados.values())
  .filter(producto => producto.cantidad > 0) // ✅ No incluir productos con cantidad 0
  .map(producto => {
  const precioConDescuento = calcularPrecioConDescuento(producto.precioUnitario, producto.descuentoPorcentaje);
  const subtotal = precioConDescuento * producto.cantidad;

return {
  'Codigo': producto.codigo,
  'Nombre': producto.descripcion,
  'Cantidad': producto.cantidad,
  'Precio un': producto.precioUnitario,
  '% descuento': producto.descuentoPorcentaje,
  'InfFact': 3,
  'Descripcion': producto.codigoBarras || '' // ✅ Solo código de barras, vacío si no tiene
};
});

      // Crear archivo Excel
      const hoja = XLSX.utils.json_to_sheet(datosExcel);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Facturación');

      // Generar nombre de archivo único
      const fecha = new Date().toISOString().split('T')[0];
      const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const nombreArchivo = `Facturacion_${fecha}_${hora}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(libro, nombreArchivo);
      // ✅ NUEVO: Eliminar pedidos de Supabase después de exportar Excel
try {
  console.log('🗑️ Eliminando pedidos facturados de Supabase...');
  
  const idsAEliminar = pedidosSeleccionados.map(p => parseInt(p.id));
  
  // Eliminar items de pedidos primero (por foreign key)
  const { error: itemsError } = await supabase
    .from('pedido_items')
    .delete()
    .in('pedido_id', idsAEliminar);
    
  if (itemsError) {
    console.error('❌ Error eliminando items:', itemsError);
  } else {
    console.log('✅ Items eliminados de Supabase');
  }
  
  // Eliminar pedidos principales
  const { error: pedidosError } = await supabase
    .from('pedidos')
    .delete()
    .in('id', idsAEliminar);
    
  if (pedidosError) {
    console.error('❌ Error eliminando pedidos:', pedidosError);
  } else {
    console.log('✅ Pedidos eliminados de Supabase');
  }
  
} catch (error) {
  console.error('❌ Error en limpieza de Supabase:', error);
}

// ✅ NUEVO: Limpiar localStorage de progreso de esos pedidos
pedidosSeleccionados.forEach(pedido => {
  localStorage.removeItem(`progreso_pedido_${pedido.id}`);
});

      // Guardar en historial
      const nuevaFactura: FacturaHistorica = {
        id: `factura-${Date.now()}`,
        fecha: new Date().toISOString(),
        pedidos: [...pedidosSeleccionados],
        total: calcularTotalConDescuentos(),
        nombreArchivo
      };

      const nuevoHistorial = [nuevaFactura, ...historialFacturacion];
      setHistorialFacturacion(nuevoHistorial);
      localStorage.setItem('historialFacturacion', JSON.stringify(nuevoHistorial));

      // Marcar pedidos como procesados
      const idsFacturados = new Set([...pedidosProcesados, ...pedidosSeleccionados.map(p => p.id)]);
      setPedidosProcesados(idsFacturados);

      alert(`✅ Excel generado: ${nombreArchivo}\n📦 ${datosExcel.length} productos\n💰 Total: $${calcularTotalConDescuentos().toLocaleString()}`);

      // Volver a la lista
      setVistaActual('lista');
      setPedidosSeleccionados([]);

    } catch (error) {
      console.error('❌ Error generando Excel:', error);
      alert('❌ Error al generar el archivo Excel');
    } finally {
      setGenerandoExcel(false);
    }
  };
  // ===== VISTAS =====

  // Vista principal - Lista de pedidos
  if (vistaActual === 'lista') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header principal */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', margin: 0 }}>
              🧾 Centro de Facturación
            </h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '16px' }}>
              Genera archivos Excel para el sistema de facturación electrónica
            </p>
          </div>
          
          {/* Herramientas de administración */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="file"
              ref={inputFileRef}
              onChange={handleImportarExcel}
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
            />
            <button
              onClick={() => inputFileRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Upload size={16} />
              Importar Excel
            </button>
            <button
              onClick={() => setVistaActual('historial')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Archive size={16} />
              Historial
            </button>
          </div>
        </div>

        {/* Estadísticas mejoradas */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #3b82f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Package size={24} style={{ color: '#3b82f6' }} />
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Pedidos Listos</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>
                  {estadisticas.totalPedidos}
                </p>
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #10b981'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <DollarSign size={24} style={{ color: '#10b981' }} />
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Total a Facturar</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>
                  ${estadisticas.totalFacturacion.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #25d366'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MessageSquare size={24} style={{ color: '#25d366' }} />
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>WhatsApp</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>
                  {estadisticas.pedidosWhatsApp}
                </p>
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '2px solid #f97316'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={24} style={{ color: '#f97316' }} />
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Estándar</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>
                  {estadisticas.pedidosEstandar}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de pedidos mejorada */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
        }}>
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Pedidos Completados para Facturación
            </h3>
            
            {pedidosListos.length > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={seleccionarTodos}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {pedidosListos.every(p => p.seleccionado) ? <CheckSquare size={16} /> : <Square size={16} />}
                  {pedidosListos.every(p => p.seleccionado) ? 'Deseleccionar' : 'Seleccionar'} Todos
                </button>
                
                <button
                  onClick={configurarFacturacion}
                  disabled={!pedidosListos.some(p => p.seleccionado)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: pedidosListos.some(p => p.seleccionado) ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: pedidosListos.some(p => p.seleccionado) ? 'pointer' : 'not-allowed'
                  }}
                >
                  <FileText size={16} />
                  Configurar Facturación ({pedidosListos.filter(p => p.seleccionado).length})
                </button>
              </div>
            )}
          </div>

          {pedidosListos.length === 0 ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: '#6b7280' 
            }}>
              <Package size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
              <p style={{ fontSize: '18px', margin: 0 }}>No hay pedidos completados para facturar</p>
              <p style={{ fontSize: '14px', margin: '8px 0 0 0' }}>
                Los pedidos aparecerán aquí cuando sean completados en el depósito
              </p>
            </div>
          ) : (
            <div style={{ padding: '0' }}>
              {pedidosListos.map((pedido, index) => (
                <div key={pedido.id} style={{
                  padding: '20px',
                  borderBottom: index < pedidosListos.length - 1 ? '1px solid #f3f4f6' : 'none',
                  backgroundColor: pedido.seleccionado ? '#f0f9ff' : 'white',
                  cursor: 'pointer'
                }} onClick={() => seleccionarPedido(pedido.id)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ marginTop: '4px' }}>
                      {pedido.seleccionado ? 
                        <CheckSquare size={20} style={{ color: '#3b82f6' }} /> : 
                        <Square size={20} style={{ color: '#9ca3af' }} />
                      }
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>
                            {pedido.numero}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <User size={14} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '14px', color: '#374151' }}>{pedido.cliente.nombre}</span>
                            {pedido.esDeWhatsApp && (
                              <span style={{
                                backgroundColor: '#25d366',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600'
                              }}>
                                📱 WhatsApp
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            📅 {pedido.fecha} | 📦 {pedido.productos.length} productos
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                            ${pedido.total.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Total real preparado
                          </div>
                        </div>
                      </div>

                      {/* Comentarios si existen */}
                      {pedido.comentarios && (
                        <div style={{
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #0ea5e9',
                          borderRadius: '8px',
                          padding: '12px',
                          marginTop: '12px'
                        }}>
                          <p style={{ 
                            margin: '0', 
                            fontSize: '14px', 
                            color: '#0c4a6e',
                            fontStyle: 'italic'
                          }}>
                            💬 <strong>Comentarios del depósito:</strong> {pedido.comentarios}
                          </p>
                        </div>
                      )}

                      {/* Vista previa de productos */}
                      <div style={{ marginTop: '12px' }}>
                        <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>
                          Productos a facturar:
                        </h5>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {pedido.productos.slice(0, 3).map((producto) => (
                            <span
                              key={producto.id}
                              style={{
                                backgroundColor: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                color: '#374151'
                              }}
                            >
                              {producto.codigo} ({producto.cantidad})
                            </span>
                          ))}
                          {pedido.productos.length > 3 && (
                            <span style={{
                              backgroundColor: '#e5e7eb',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              +{pedido.productos.length - 3} más
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ✅ VISTA CONFIGURAR COMPLETAMENTE NUEVA CON EDICIÓN COMPLETA
  if (vistaActual === 'configurar') {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header de configuración */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
              ⚙️ Configurar Facturación
            </h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '16px' }}>
              Edita cantidades, precios y descuentos antes de generar el Excel
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setVistaActual('lista')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            
            <button
              onClick={verPreview}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Eye size={16} />
              Vista Previa
            </button>
          </div>
        </div>

        {/* Herramientas globales */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
            🛠️ Herramientas Globales
          </h3>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Percent size={16} style={{ color: '#6b7280' }} />
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Descuento Global:</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={descuentoGlobal}
                onChange={(e) => setDescuentoGlobal(parseFloat(e.target.value) || 0)}
                style={{
                  width: '80px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <span style={{ fontSize: '14px', color: '#6b7280' }}>%</span>
              <button
                onClick={aplicarDescuentoGlobal}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Aplicar a Todos
              </button>
            </div>

            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#111827',
              marginLeft: 'auto'
            }}>
              💰 Total: ${calcularTotalConDescuentos().toLocaleString()}
            </div>
          </div>
        </div>

        {/* Lista de pedidos para configurar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pedidosSeleccionados.map((pedido) => (
            <div key={pedido.id} style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              {/* Header del pedido */}
              <div style={{
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>
                      {pedido.numero} - {pedido.cliente.nombre}
                    </h4>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      📦 {pedido.productos.length} productos
                      {pedido.esDeWhatsApp && <span style={{ marginLeft: '8px' }}>📱 WhatsApp</span>}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => agregarProductoManual(pedido.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} />
                    Agregar Producto
                  </button>
                </div>
              </div>

              {/* Productos editables */}
              <div style={{ padding: '0' }}>
                {pedido.productos.map((producto, index) => (
                  <div key={producto.id} style={{
                    padding: '16px 20px',
                    borderBottom: index < pedido.productos.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: producto.cantidad === 0 ? '#fef2f2' : 'white'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto auto', gap: '12px', alignItems: 'center' }}>
                      {/* Código y nombre del producto */}
                      <div style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                          {producto.codigo}
                          {/* ✅ Indicador de ajuste de inventario */}
                          {producto.cantidadOriginalPreparada && producto.cantidad !== producto.cantidadOriginalPreparada && (
                            <span style={{
                              marginLeft: '6px',
                              backgroundColor: producto.cantidad < producto.cantidadOriginalPreparada ? '#10b981' : '#f59e0b',
                              color: 'white',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              fontSize: '9px',
                              fontWeight: '600'
                            }}>
                              {producto.cantidad < producto.cantidadOriginalPreparada ? '📦↑' : '⚠️↓'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {producto.nombre}
                        </div>
                        {producto.cantidadOriginalPreparada && producto.cantidad !== producto.cantidadOriginalPreparada && (
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>
                            🏭 Preparado: {producto.cantidadOriginalPreparada} → 🧾 Facturar: {producto.cantidad}
                          </div>
                        )}
                        {producto.codigoBarras && (
                          <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                            📊 {producto.codigoBarras}
                          </div>
                        )}
                      </div>

                      {/* Cantidad editable */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => editarCantidadProducto(pedido.id, producto.id, producto.cantidad - 1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={producto.cantidad}
                          onChange={(e) => editarCantidadProducto(pedido.id, producto.id, parseInt(e.target.value) || 0)}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            border: `1px solid ${producto.cantidad === 0 ? '#ef4444' : '#d1d5db'}`,
                            borderRadius: '4px',
                            fontSize: '14px',
                            textAlign: 'center',
                            backgroundColor: producto.cantidad === 0 ? '#fef2f2' : 'white'
                          }}
                        />
                        
                        <button
                          onClick={() => editarCantidadProducto(pedido.id, producto.id, producto.cantidad + 1)}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Precio editable */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} style={{ color: '#6b7280' }} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={producto.precioUnitario}
                          onChange={(e) => editarPrecioProducto(pedido.id, producto.id, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '80px',
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>

                      {/* Descuento editable */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Percent size={14} style={{ color: '#6b7280' }} />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={producto.descuentoPorcentaje}
                          onChange={(e) => editarDescuentoProducto(pedido.id, producto.id, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                      </div>

                      {/* Precio final calculado */}
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: producto.cantidad === 0 ? '#ef4444' : '#111827',
                        minWidth: '80px',
                        textAlign: 'right'
                      }}>
                        ${calcularPrecioConDescuento(producto.precioUnitario, producto.descuentoPorcentaje).toFixed(2)}
                      </div>

                      {/* Subtotal */}
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '700',
                        color: producto.cantidad === 0 ? '#ef4444' : '#10b981',
                        minWidth: '100px',
                        textAlign: 'right'
                      }}>
                        ${(calcularPrecioConDescuento(producto.precioUnitario, producto.descuentoPorcentaje) * producto.cantidad).toFixed(2)}
                      </div>

                      {/* Botón eliminar */}
                      <button
                        onClick={() => removerProducto(pedido.id, producto.id)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Vista preview
  if (vistaActual === 'preview') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px' 
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
            👁️ Vista Previa del Excel
          </h1>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setVistaActual('configurar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} />
              Editar
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ 
          backgroundColor: '#f0f9ff', 
          border: '2px solid #3b82f6', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0', color: '#1e40af' }}>
            📊 Resumen de Facturación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>Pedidos</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
                {pedidosSeleccionados.length}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>Total de Productos</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
                {pedidosSeleccionados.reduce((sum, p) => sum + p.productos.length, 0)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>Total General</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                ${calcularTotalConDescuentos().toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Botón generar */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <button
            onClick={generarExcel}
            disabled={generandoExcel}
            style={{
              padding: '12px 24px',
              backgroundColor: generandoExcel ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: generandoExcel ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
          >
            {generandoExcel ? (
              <>
                <RefreshCw size={18} />
                Generando...
              </>
            ) : (
              <>
                <Download size={18} />
                Confirmar y Descargar Excel
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Vista historial
  if (vistaActual === 'historial') {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px' 
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
            📚 Historial de Facturación
          </h1>
          
          <button
            onClick={() => setVistaActual('lista')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>

        {historialFacturacion.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#6b7280' 
          }}>
            <Archive size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
            <p style={{ fontSize: '18px', margin: 0 }}>No hay facturas generadas</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {historialFacturacion.map((factura) => (
              <div key={factura.id} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>
                      {factura.nombreArchivo}
                    </h4>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      📅 {new Date(factura.fecha).toLocaleDateString()} | 
                      📦 {factura.pedidos.length} pedidos | 
                      💰 ${factura.total.toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      ✅ Procesado
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ✅ VISTA PRINCIPAL MEJORADA sin duplicados
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header principal */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', margin: 0 }}>
            🧾 Centro de Facturación
          </h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '16px' }}>
            Genera archivos Excel para el sistema de facturación electrónica
          </p>
        </div>
        
        {/* Herramientas de administración */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="file"
            ref={inputFileRef}
            onChange={handleImportarExcel}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
          />
          <button
            onClick={() => inputFileRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <Upload size={16} />
            Importar Excel
          </button>
          <button
            onClick={() => setVistaActual('historial')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <Archive size={16} />
            Historial
          </button>
        </div>
      </div>
    </div>
  );
};

export default Facturacion;
