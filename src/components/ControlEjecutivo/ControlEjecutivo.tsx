import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Package,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  MessageSquare,
  Calendar,
  Target,
  Activity
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

// ✅ INTERFACES COMPLETAS
interface VarianteProducto {
  id: string;
  color: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
}

interface ProductoEjecutivo {
  id: string;
  codigo: string;
  nombre: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
  precio?: number;
  variantes?: VarianteProducto[];
  descripcion?: string;
  comentarioProducto?: string;
}

interface ClienteEjecutivo {
  id: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
}

interface PedidoEjecutivo {
  id: string;
  numero: string;
  cliente: ClienteEjecutivo;
  fecha: string;
  estado: 'pendiente' | 'preparando' | 'completado' | 'entregado';
  productos: ProductoEjecutivo[];
  comentarios?: string;
  comentarioFinal?: string;
  total?: number;
  fechaCompletado?: string;
  esDeWhatsApp?: boolean;
  progreso: number; // ✅ PORCENTAJE CALCULADO
}

interface EstadisticasGlobales {
  totalPedidos: number;
  pendientes: number;
  preparando: number;
  completados: number;
  facturados: number;
  progresoGlobal: number;
  valorTotal: number;
  pedidosHoy: number;
}

const ControlEjecutivo: React.FC = () => {
  // ✅ ESTADOS PRINCIPALES
  const [pedidos, setPedidos] = useState<PedidoEjecutivo[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasGlobales>({
    totalPedidos: 0,
    pendientes: 0,
    preparando: 0,
    completados: 0,
    facturados: 0,
    progresoGlobal: 0,
    valorTotal: 0,
    pedidosHoy: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ ESTADOS DE INTERFAZ
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'pendientes' | 'preparando' | 'completados'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarExportacion, setMostrarExportacion] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());

  // ✅ FUNCIÓN PARA CALCULAR PROGRESO (misma lógica que Pedidos.tsx)
  const calcularProgreso = (productos: ProductoEjecutivo[]): number => {
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

  // ✅ FUNCIÓN PARA CONVERTIR DATOS DE SUPABASE
  const convertirPedidoDeSupabase = async (dbPedido: any, dbItems: any[]): Promise<PedidoEjecutivo> => {
    // Agrupar items por código de producto
    const productosMap = new Map<string, ProductoEjecutivo>();

    // Obtener datos de inventario para nombres reales
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
          nombre: datosInv?.descripcion || `Producto ${codigo}`,
          cantidadPedida: 0,
          cantidadPreparada: 0,
          estado: 'pendiente',
          precio: item.precio_unitario,
          variantes: [],
          comentarioProducto: item.comentarios || '',
          descripcion: datosInv?.descripcion || `Producto ${codigo}`
        });
      }

      const producto = productosMap.get(codigo)!;
      
      // Si hay variante de color, es un producto con variantes
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
        producto.estado = item.estado as 'pendiente' | 'completado' | 'sin_stock';
      }
    });

    const productos = Array.from(productosMap.values());
    const progreso = calcularProgreso(productos);

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
      productos: productos,
      comentarios: dbPedido.comentarios || '',
      comentarioFinal: extraerComentarioFinal(dbPedido.comentarios || ''),
      total: dbPedido.total || 0,
      fechaCompletado: dbPedido.fecha_completado ? new Date(dbPedido.fecha_completado).toISOString().split('T')[0] : undefined,
      esDeWhatsApp: dbPedido.origen === 'whatsapp',
      progreso: progreso
    };
  };

  // ✅ FUNCIÓN PARA EXTRAER COMENTARIO FINAL
  const extraerComentarioFinal = (comentarios: string): string => {
    const match = comentarios.match(/Comentario final:\s*(.+?)(?:\n|$)/);
    return match ? match[1].trim() : '';
  };

  // ✅ CARGAR PEDIDOS DESDE SUPABASE
  const cargarPedidos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Control Ejecutivo: Cargando pedidos...');

      // Obtener todos los pedidos (excepto entregados)
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .not('estado', 'eq', 'entregado')
        .order('fecha_pedido', { ascending: false });

      if (pedidosError) {
        throw pedidosError;
      }

      console.log('✅ Pedidos obtenidos:', pedidosData?.length || 0);

      // Convertir cada pedido con sus items
      const pedidosConvertidos: PedidoEjecutivo[] = [];
      
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

      setPedidos(pedidosConvertidos);
      calcularEstadisticas(pedidosConvertidos);
      setUltimaActualizacion(new Date());
      
      console.log('✅ Control Ejecutivo: Datos cargados exitosamente');

    } catch (err) {
      console.error('❌ Error cargando pedidos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // ✅ CALCULAR ESTADÍSTICAS GLOBALES
  const calcularEstadisticas = (pedidosList: PedidoEjecutivo[]) => {
    const hoy = new Date().toISOString().split('T')[0];
    
    const stats: EstadisticasGlobales = {
      totalPedidos: pedidosList.length,
      pendientes: pedidosList.filter(p => p.estado === 'pendiente').length,
      preparando: pedidosList.filter(p => p.estado === 'preparando').length,
      completados: pedidosList.filter(p => p.estado === 'completado').length,
      facturados: 0, // Los facturados se eliminan automáticamente
      progresoGlobal: 0,
      valorTotal: pedidosList.reduce((sum, p) => sum + (p.total || 0), 0),
      pedidosHoy: pedidosList.filter(p => p.fecha === hoy).length
    };

    // Calcular progreso global
    if (pedidosList.length > 0) {
      const progresoTotal = pedidosList.reduce((sum, p) => sum + p.progreso, 0);
      stats.progresoGlobal = Math.round(progresoTotal / pedidosList.length);
    }

    setEstadisticas(stats);
  };

  // ✅ FILTRAR PEDIDOS
  const pedidosFiltrados = pedidos.filter(pedido => {
    // Filtro por estado
    let matchEstado = true;
    switch (filtroActivo) {
      case 'pendientes':
        matchEstado = pedido.estado === 'pendiente';
        break;
      case 'preparando':
        matchEstado = pedido.estado === 'preparando';
        break;
      case 'completados':
        matchEstado = pedido.estado === 'completado';
        break;
      default:
        matchEstado = true;
    }

    // Filtro por búsqueda
    const matchBusqueda = busqueda === '' ||
      pedido.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      pedido.numero.toLowerCase().includes(busqueda.toLowerCase());

    return matchEstado && matchBusqueda;
  });

  // ✅ EXPORTAR A EXCEL
  const exportarExcel = () => {
    try {
      const datosExcel = pedidosFiltrados.map(pedido => ({
        'Número Pedido': pedido.numero,
        'Cliente': pedido.cliente.nombre,
        'Teléfono': pedido.cliente.telefono || '',
        'Fecha': pedido.fecha,
        'Estado': pedido.estado.toUpperCase(),
        'Progreso %': `${pedido.progreso}%`,
        'Total Productos': pedido.productos.length,
        'Total Unidades': pedido.productos.reduce((sum, p) => sum + p.cantidadPedida, 0),
        'Valor Total': pedido.total || 0,
        'Origen': pedido.esDeWhatsApp ? 'WhatsApp' : 'Manual',
        'Comentarios': pedido.comentarios || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datosExcel);
      
      // Ajustar ancho de columnas
      ws['!cols'] = [
        { wch: 15 }, // Número Pedido
        { wch: 25 }, // Cliente
        { wch: 15 }, // Teléfono
        { wch: 12 }, // Fecha
        { wch: 12 }, // Estado
        { wch: 10 }, // Progreso
        { wch: 15 }, // Total Productos
        { wch: 15 }, // Total Unidades
        { wch: 15 }, // Valor Total
        { wch: 12 }, // Origen
        { wch: 30 }  // Comentarios
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Control_Ejecutivo');
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
      const nombreArchivo = `Control_Ejecutivo_Feraben_${timestamp}.xlsx`;
      
      XLSX.writeFile(wb, nombreArchivo);
      
      alert(`✅ Excel exportado exitosamente!\n\n📄 ${nombreArchivo}\n📊 ${datosExcel.length} pedidos incluidos`);
      setMostrarExportacion(false);
      
    } catch (error) {
      console.error('Error exportando Excel:', error);
      alert('❌ Error al exportar Excel');
    }
  };

  // ✅ CARGAR DATOS AL INICIAR
  useEffect(() => {
    cargarPedidos();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(cargarPedidos, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Cargando Control Ejecutivo...</p>
      </div>
    );
  }

  // ✅ ERROR STATE
  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        backgroundColor: '#fef2f2',
        borderRadius: '12px',
        border: '2px solid #fecaca',
        margin: '20px'
      }}>
        <AlertTriangle size={48} style={{ color: '#dc2626', marginBottom: '16px' }} />
        <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>Error de Conexión</h3>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={cargarPedidos}
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 auto'
          }}
        >
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '24px', 
      maxWidth: '1400px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* ✅ HEADER EJECUTIVO */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: '2px solid #3b82f6'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: '#1e40af', 
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <BarChart3 size={36} style={{ color: '#3b82f6' }} />
              📈 CONTROL EJECUTIVO
            </h1>
            <p style={{ 
              color: '#64748b', 
              margin: '0 0 4px 0',
              fontSize: '16px'
            }}>
              Dashboard integral de pedidos - FERABEN SRL
            </p>
            <p style={{ 
              color: '#94a3b8', 
              margin: 0,
              fontSize: '14px'
            }}>
              Última actualización: {ultimaActualizacion.toLocaleTimeString()} • Auto-refresh activo
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={cargarPedidos}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
            
            <button
              onClick={() => setMostrarExportacion(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* ✅ MÉTRICAS PRINCIPALES */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        {/* Total Pedidos */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Package size={24} style={{ color: '#6b7280' }} />
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>TOTAL</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: '0 0 4px 0' }}>
            {estadisticas.totalPedidos}
          </p>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Pedidos activos</p>
        </div>

        {/* Pendientes */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #f59e0b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Clock size={24} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600' }}>PENDIENTES</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#d97706', margin: '0 0 4px 0' }}>
            {estadisticas.pendientes}
          </p>
          <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>Por iniciar</p>
        </div>

        {/* En Preparación */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Activity size={24} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>PREPARANDO</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#1e40af', margin: '0 0 4px 0' }}>
            {estadisticas.preparando}
          </p>
          <p style={{ fontSize: '12px', color: '#1e40af', margin: 0 }}>En depósito</p>
        </div>

        {/* Completados */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #22c55e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <CheckCircle size={24} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>LISTOS</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#166534', margin: '0 0 4px 0' }}>
            {estadisticas.completados}
          </p>
          <p style={{ fontSize: '12px', color: '#166534', margin: 0 }}>Para facturar</p>
        </div>

        {/* Progreso Global */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #8b5cf6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Target size={24} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600' }}>PROGRESO</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#7c3aed', margin: '0 0 4px 0' }}>
            {estadisticas.progresoGlobal}%
          </p>
          <p style={{ fontSize: '12px', color: '#7c3aed', margin: 0 }}>Completado global</p>
        </div>

        {/* Valor Total */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '2px solid #059669'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <DollarSign size={24} style={{ color: '#059669' }} />
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>VALOR TOTAL</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '800', color: '#047857', margin: '0 0 4px 0' }}>
            ${estadisticas.valorTotal.toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', color: '#047857', margin: 0 }}>En pedidos activos</p>
        </div>
      </div>

      {/* ✅ CONTROLES Y FILTROS */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* Búsqueda */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={20} style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#6b7280' 
            }} />
            <input
              type="text"
              placeholder="Buscar por cliente o número de pedido..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 44px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'todos', label: 'Todos', count: estadisticas.totalPedidos, color: '#6b7280' },
            { key: 'pendientes', label: 'Pendientes', count: estadisticas.pendientes, color: '#f59e0b' },
            { key: 'preparando', label: 'Preparando', count: estadisticas.preparando, color: '#3b82f6' },
            { key: 'completados', label: 'Listos', count: estadisticas.completados, color: '#22c55e' }
          ].map(filtro => (
            <button
              key={filtro.key}
              onClick={() => setFiltroActivo(filtro.key as any)}
              style={{
                padding: '8px 16px',
                backgroundColor: filtroActivo === filtro.key ? filtro.color : 'white',
                color: filtroActivo === filtro.key ? 'white' : filtro.color,
                border: `2px solid ${filtro.color}`,
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {filtro.label} ({filtro.count})
            </button>
          ))}
        </div>
      </div>

      {/* ✅ LISTA MAESTRA DE PEDIDOS */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e5e7eb',
          backgroundColor: '#f8fafc'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Package size={20} />
            Lista Maestra de Pedidos ({pedidosFiltrados.length})
          </h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
            Vista ejecutiva completa • Actualización en tiempo real
          </p>
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Package size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
            <p style={{ fontSize: '18px', color: '#6b7280', margin: 0 }}>
              No hay pedidos que coincidan con los filtros seleccionados
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {pedidosFiltrados.map((pedido, index) => (
              <div
                key={pedido.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: index < pedidosFiltrados.length - 1 ? '1px solid #e5e7eb' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                {/* Estado Visual */}
                <div style={{ 
                  width: '12px',
                  height: '60px',
                  borderRadius: '6px',
                  backgroundColor: 
                    pedido.estado === 'completado' ? '#22c55e' :
                    pedido.estado === 'preparando' ? '#3b82f6' :
                    '#f59e0b'
                }} />

                {/* Información Principal */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1f2937',
                      margin: 0
                    }}>
                      {pedido.cliente.nombre}
                    </h3>
                    <span style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {pedido.numero}
                    </span>
                    {pedido.esDeWhatsApp && (
                      <span style={{
                        fontSize: '12px',
                        backgroundColor: '#25d366',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        📱 WhatsApp
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                    <span>📅 {pedido.fecha}</span>
                    <span>📦 {pedido.productos.length} productos</span>
                    <span>🔢 {pedido.productos.reduce((sum, p) => sum + p.cantidadPedida, 0)} unidades</span>
                    {pedido.total && <span>💰 ${pedido.total.toLocaleString()}</span>}
                  </div>
                </div>

                {/* Estado y Progreso */}
                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    marginBottom: '8px',
                    backgroundColor: 
                      pedido.estado === 'completado' ? '#dcfce7' :
                      pedido.estado === 'preparando' ? '#dbeafe' :
                      '#fef3c7',
                    color: 
                      pedido.estado === 'completado' ? '#166534' :
                      pedido.estado === 'preparando' ? '#1e40af' :
                      '#92400e'
                  }}>
                    {pedido.estado === 'completado' ? '✅ LISTO' :
                     pedido.estado === 'preparando' ? '🔵 PREPARANDO' :
                     '🟡 PENDIENTE'}
                  </div>
                  
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
                    {pedido.progreso}%
                  </div>
                  
                  <div style={{
                    width: '80px',
                    height: '6px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '3px',
                    marginTop: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${pedido.progreso}%`,
                      height: '100%',
                      backgroundColor: 
                        pedido.progreso === 100 ? '#22c55e' :
                        pedido.progreso > 50 ? '#3b82f6' :
                        pedido.progreso > 0 ? '#f59e0b' : '#e5e7eb',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ MODAL DE EXPORTACIÓN */}
      {mostrarExportacion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: '#1f2937' }}>
              Exportar Control Ejecutivo
            </h3>
            
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              Se exportarán {pedidosFiltrados.length} pedidos con todos los detalles y métricas.
              El archivo incluirá: número, cliente, estado, progreso, totales y comentarios.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMostrarExportacion(false)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              
              <button
                onClick={exportarExcel}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlEjecutivo;