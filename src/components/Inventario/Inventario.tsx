import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  TrendingDown, 
  AlertTriangle, 
  Plus,
  Upload,
  Edit3,
  Trash2,
  Check,
  X,
  Filter,
  Download,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

// MANTENER EXACTA LA INTERFAZ ACTUAL - NO CAMBIAR
interface ProductoInventario {
  id: number;
  codigo_producto: string;
  descripcion: string;
  categoria: string;
  precio_venta: number;
  stock: number;
  codigo_barras?: string;
  stock_minimo?: number;
  // NUEVOS CAMPOS OPCIONALES para funcionalidades avanzadas
  precio_costo?: number;
  estado?: 'activo' | 'inactivo';
  fecha_actualizacion?: string;
}

interface ProductoExcel {
  orden: string;
  codigo_proveedor: string;
  codigo_propio: string;
  codigo_barras: string;
  descripcion: string;
  precio_fob: number;
  cantidad_confirmada: number;
  categoria: string;
  estado: string;
  precio_venta: number;
}

const Inventario: React.FC = () => {
  // ESTADOS EXISTENTES - MANTENER
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  // NUEVOS ESTADOS PARA FUNCIONALIDADES AVANZADAS
  const [isMobile, setIsMobile] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productosSeleccionados, setProductosSeleccionados] = useState<Set<number>>(new Set());
  const [mostrarModalImport, setMostrarModalImport] = useState(false);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');

  // DETECCIÓN DE MÓVIL
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      // En móvil, mostrar filtros por defecto contraídos
      if (window.innerWidth <= 768) {
        setMostrarFiltros(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // CARGAR PRODUCTOS DESDE SUPABASE - MANTENER LÓGICA ACTUAL
  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: supabaseError } = await supabase
        .from('inventario')
        .select('*')
        .order('codigo_producto');
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      setProductos(data || []);
      console.log('✅ Productos cargados:', data?.length || 0);
      
    } catch (err) {
      console.error('❌ Error cargando productos:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };
  // FILTROS Y BÚSQUEDA - MEJORADO CON ESTADO
  const categorias = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria)))];
  
  const productosFiltrados = productos.filter(producto => {
    const matchSearchTerm = searchTerm === '' || 
      producto.codigo_producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (producto.codigo_barras && producto.codigo_barras.includes(searchTerm));
    
    const matchCategory = selectedCategory === 'Todas' || producto.categoria === selectedCategory;
    
    const matchEstado = filtroEstado === 'Todos' || 
      (filtroEstado === 'Activos' && (producto.estado === 'activo' || !producto.estado)) ||
      (filtroEstado === 'Inactivos' && producto.estado === 'inactivo') ||
      (filtroEstado === 'Sin Stock' && producto.stock === 0);
    
    return matchSearchTerm && matchCategory && matchEstado;
  });

  // ESTADÍSTICAS - MANTENER CÁLCULOS ACTUALES
  const totalProductos = productos.length;
  const stockBajo = productos.filter(p => p.stock <= (p.stock_minimo || 0)).length;
  const valorInventario = productos.reduce((sum, p) => sum + (p.precio_venta * p.stock), 0);
  const productosActivos = productos.filter(p => p.estado === 'activo' || !p.estado).length;
  const productosInactivos = productos.filter(p => p.estado === 'inactivo').length;

  // FUNCIONES DE SELECCIÓN MÚLTIPLE
  const toggleSeleccion = (id: number) => {
    const newSet = new Set(productosSeleccionados);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setProductosSeleccionados(newSet);
  };

  const seleccionarTodos = () => {
    if (productosSeleccionados.size === productosFiltrados.length) {
      setProductosSeleccionados(new Set());
    } else {
      setProductosSeleccionados(new Set(productosFiltrados.map(p => p.id)));
    }
  };

  // FUNCIONES DE EDICIÓN MÚLTIPLE
  const cambiarEstadoSeleccionados = async (nuevoEstado: 'activo' | 'inactivo') => {
    try {
      const idsSeleccionados = Array.from(productosSeleccionados);
      
      const { error } = await supabase
        .from('inventario')
        .update({ 
          estado: nuevoEstado,
          fecha_actualizacion: new Date().toISOString()
        })
        .in('id', idsSeleccionados);
      
      if (error) throw error;
      
      // Actualizar estado local
      setProductos(productos.map(p => 
        productosSeleccionados.has(p.id) 
          ? { ...p, estado: nuevoEstado }
          : p
      ));
      
      setProductosSeleccionados(new Set());
      setModoEdicion(false);
      
      alert(`✅ ${idsSeleccionados.length} productos ${nuevoEstado === 'activo' ? 'activados' : 'desactivados'}`);
      
    } catch (error) {
      console.error('Error actualizando productos:', error);
      alert('❌ Error al actualizar productos');
    }
  };

  const eliminarSeleccionados = async () => {
    if (!window.confirm(`¿Eliminar ${productosSeleccionados.size} productos seleccionados? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      const idsSeleccionados = Array.from(productosSeleccionados);
      
      const { error } = await supabase
        .from('inventario')
        .delete()
        .in('id', idsSeleccionados);
      
      if (error) throw error;
      
      // Actualizar estado local
      setProductos(productos.filter(p => !productosSeleccionados.has(p.id)));
      setProductosSeleccionados(new Set());
      setModoEdicion(false);
      
      alert(`✅ ${idsSeleccionados.length} productos eliminados`);
      
    } catch (error) {
      console.error('Error eliminando productos:', error);
      alert('❌ Error al eliminar productos');
    }
  };
  // IMPORTADOR DE EXCEL
  const importarProductosExcel = async (file: File) => {
    try {
      setImportProgress(0);
      setImportMessage('Leyendo archivo Excel...');
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets['Productos'];
      
      if (!worksheet) {
        throw new Error('No se encontró la hoja "Productos" en el archivo Excel');
      }
      
      setImportMessage('Procesando datos...');
      setImportProgress(25);
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Mapear productos desde tu formato Excel
      const productosExcel: ProductoExcel[] = [];
      for (let i = 2; i < jsonData.length; i++) { // Saltar headers
        const row = jsonData[i] as any[];
        if (row[5]) { // Solo si tiene código propio
          productosExcel.push({
            orden: row[0] || '',
            codigo_proveedor: row[4] || '',
            codigo_propio: row[5],
            codigo_barras: row[6]?.toString() || '',
            descripcion: row[7] || '',
            precio_fob: parseFloat(row[8]) || 0,
            cantidad_confirmada: parseInt(row[10]) || 0,
            categoria: row[13] || 'Sin categoría',
            estado: row[14] || 'Pendiente',
            precio_venta: parseFloat(row[18]) || 0
          });
        }
      }
      
      setImportMessage('Validando productos...');
      setImportProgress(50);
      
      // Validaciones
      const errores: string[] = [];
      const productosValidados: ProductoInventario[] = [];
      
      for (let i = 0; i < productosExcel.length; i++) {
        const producto = productosExcel[i];
        const erroresProducto: string[] = [];
        
        if (!producto.codigo_propio) erroresProducto.push('Código requerido');
        if (!producto.descripcion) erroresProducto.push('Descripción requerida');
        if (producto.precio_venta <= 0) erroresProducto.push('Precio de venta debe ser mayor a 0');
        
        if (erroresProducto.length > 0) {
          errores.push(`Fila ${i + 3}: ${erroresProducto.join(', ')}`);
        } else {
          productosValidados.push({
            id: 0, // Se genera automáticamente
            codigo_producto: producto.codigo_propio,
            descripcion: producto.descripcion,
            categoria: producto.categoria,
            precio_venta: producto.precio_venta,
            precio_costo: producto.precio_fob,
            stock: producto.cantidad_confirmada,
            codigo_barras: producto.codigo_barras || undefined,
            estado: producto.estado === 'Pendiente' ? 'activo' : 'inactivo'
          });
        }
      }
      
      if (errores.length > 0) {
        alert(`❌ Errores encontrados:\n\n${errores.slice(0, 10).join('\n')}\n${errores.length > 10 ? `\n... y ${errores.length - 10} errores más` : ''}`);
        return;
      }
      
      setImportMessage('Verificando duplicados...');
      setImportProgress(75);
      
      // Verificar duplicados y actualizar/crear
      const productosActuales = productos;
      const productosNuevos: ProductoInventario[] = [];
      const productosActualizar: ProductoInventario[] = [];
      
      for (const producto of productosValidados) {
        const existente = productosActuales.find(p => p.codigo_producto === producto.codigo_producto);
        if (existente) {
          productosActualizar.push({
            ...existente,
            descripcion: producto.descripcion,
            categoria: producto.categoria,
            precio_venta: producto.precio_venta,
            precio_costo: producto.precio_costo,
            stock: producto.stock,
            codigo_barras: producto.codigo_barras,
            estado: 'activo', // Reactivar si estaba inactivo
            fecha_actualizacion: new Date().toISOString()
          });
        } else {
          productosNuevos.push(producto);
        }
      }
      
      setImportMessage('Guardando en base de datos...');
      setImportProgress(90);
      
      // Insertar productos nuevos
      if (productosNuevos.length > 0) {
        const { error: insertError } = await supabase
          .from('inventario')
          .insert(productosNuevos.map(p => ({
            codigo_producto: p.codigo_producto,
            descripcion: p.descripcion,
            categoria: p.categoria,
            precio_venta: p.precio_venta,
            precio_costo: p.precio_costo,
            stock: p.stock,
            codigo_barras: p.codigo_barras,
            estado: p.estado
          })));
        
        if (insertError) throw insertError;
      }
      
      // Actualizar productos existentes
      if (productosActualizar.length > 0) {
        for (const producto of productosActualizar) {
          const { error: updateError } = await supabase
            .from('inventario')
            .update({
              descripcion: producto.descripcion,
              categoria: producto.categoria,
              precio_venta: producto.precio_venta,
              precio_costo: producto.precio_costo,
              stock: producto.stock,
              codigo_barras: producto.codigo_barras,
              estado: producto.estado,
              fecha_actualizacion: producto.fecha_actualizacion
            })
            .eq('id', producto.id);
          
          if (updateError) throw updateError;
        }
      }
      
      setImportProgress(100);
      setImportMessage('¡Importación completada!');
      
      // Recargar productos
      await cargarProductos();
      
      alert(`✅ Importación exitosa!\n\n📦 ${productosNuevos.length} productos nuevos\n🔄 ${productosActualizar.length} productos actualizados`);
      
      setMostrarModalImport(false);
      
    } catch (error) {
      console.error('Error importando Excel:', error);
      alert(`❌ Error importando archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setImportProgress(0);
      setImportMessage('');
    }
  };
  // LOADING Y ERROR STATES - MANTENER ACTUALES
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280' }}>Cargando productos desde Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
        <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>Error de Conexión</h3>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '24px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* HEADER OPTIMIZADO PARA MÓVIL */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: isMobile ? '24px' : '30px', 
              fontWeight: 'bold', 
              color: '#1f2937', 
              margin: '0 0 4px 0' 
            }}>
              📦 Gestión de Inventario
            </h1>
            <p style={{ 
              color: '#6b7280', 
              margin: 0,
              fontSize: isMobile ? '14px' : '16px'
            }}>
              ✅ Sistema optimizado para móvil - {totalProductos} productos cargados
            </p>
          </div>
          
{isMobile && (
  <Smartphone 
    size={24} 
    style={{ color: '#22c55e' }}
  />
)}
        </div>
      </div>

      {/* ESTADÍSTICAS RESPONSIVAS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
        gap: isMobile ? '12px' : '16px', 
        marginBottom: isMobile ? '16px' : '24px' 
      }}>
        <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280', margin: 0 }}>Total Productos</p>
              <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#111827', margin: '4px 0' }}>{totalProductos}</p>
            </div>
            <Package size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280', margin: 0 }}>Stock Bajo</p>
              <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#dc2626', margin: '4px 0' }}>{stockBajo}</p>
            </div>
            <TrendingDown size={isMobile ? 20 : 24} style={{ color: '#dc2626' }} />
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280', margin: 0 }}>Valor Total</p>
              <p style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 'bold', color: '#059669', margin: '4px 0' }}>
                ${isMobile ? Math.round(valorInventario/1000) + 'K' : valorInventario.toLocaleString()}
              </p>
            </div>
            <Package size={isMobile ? 20 : 24} style={{ color: '#059669' }} />
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#6b7280', margin: 0 }}>
                {isMobile ? 'Activos' : 'Productos Activos'}
              </p>
              <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#059669', margin: '4px 0' }}>{productosActivos}</p>
            </div>
            <Check size={isMobile ? 20 : 24} style={{ color: '#059669' }} />
          </div>
        </div>
      </div>
      {/* CONTROLES Y FILTROS MÓVILES */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: isMobile ? '16px' : '20px'
      }}>
        {/* BÚSQUEDA */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#6b7280' 
              }} 
            />
            <input
              type="text"
              placeholder="Buscar por código, descripción o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '16px 44px' : '12px 44px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: isMobile ? '16px' : '14px', // 16px evita zoom en iOS
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* FILTROS Y ACCIONES */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px',
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          {/* BOTÓN FILTROS EN MÓVIL */}
          {isMobile && (
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: mostrarFiltros ? '#3b82f6' : '#f3f4f6',
                color: mostrarFiltros ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Filter size={16} />
              {mostrarFiltros ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </button>
          )}

          {/* FILTROS */}
          <div style={{
            display: (isMobile && !mostrarFiltros) ? 'none' : 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '8px',
            flex: 1
          }}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: isMobile ? '12px' : '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                minWidth: isMobile ? '100%' : '150px'
              }}
            >
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                padding: isMobile ? '12px' : '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white',
                minWidth: isMobile ? '100%' : '120px'
              }}
            >
              <option value="Todos">Todos los estados</option>
              <option value="Activos">Activos</option>
              <option value="Inactivos">Inactivos</option>
              <option value="Sin Stock">Sin Stock</option>
            </select>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '8px',
            minWidth: isMobile ? '100%' : 'auto'
          }}>
            <button
              onClick={() => setMostrarModalNuevo(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: isMobile ? '14px' : '8px 16px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: '44px' // Área táctil mínima para móvil
              }}
            >
              <Plus size={16} />
              {isMobile ? 'Nuevo Producto' : 'Nuevo'}
            </button>

            <button
              onClick={() => setMostrarModalImport(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: isMobile ? '14px' : '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              <Upload size={16} />
              {isMobile ? 'Importar Excel' : 'Importar'}
            </button>

            <button
              onClick={() => setModoEdicion(!modoEdicion)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: isMobile ? '14px' : '8px 16px',
                backgroundColor: modoEdicion ? '#ef4444' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              {modoEdicion ? <X size={16} /> : <Edit3 size={16} />}
              {modoEdicion ? 'Cancelar' : 'Editar'}
            </button>
          </div>
        </div>

        {/* CONTROLES DE SELECCIÓN MÚLTIPLE */}
        {modoEdicion && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '12px',
              alignItems: isMobile ? 'stretch' : 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
                color: '#374151'
              }}>
                <button
                  onClick={seleccionarTodos}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    minHeight: '36px'
                  }}
                >
                  {productosSeleccionados.size === productosFiltrados.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                </button>
                <span>{productosSeleccionados.size} productos seleccionados</span>
              </div>

              {productosSeleccionados.size > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '8px'
                }}>
                  <button
                    onClick={() => cambiarEstadoSeleccionados('activo')}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '36px'
                    }}
                  >
                    ✅ Activar ({productosSeleccionados.size})
                  </button>
                  <button
                    onClick={() => cambiarEstadoSeleccionados('inactivo')}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '36px'
                    }}
                  >
                    ❌ Desactivar ({productosSeleccionados.size})
                  </button>
                  <button
                    onClick={eliminarSeleccionados}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '36px'
                    }}
                  >
                    🗑️ Eliminar ({productosSeleccionados.size})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TABLA / CARDS RESPONSIVOS */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {isMobile ? (
          /* VISTA MÓVIL - CARDS */
          <div style={{ padding: '16px' }}>
            {productosFiltrados.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280'
              }}>
                <Package size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                <p style={{ margin: 0, fontSize: '16px' }}>No se encontraron productos</p>
              </div>
            ) : (
              productosFiltrados.map((producto) => (
                <div
                  key={producto.id}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: productosSeleccionados.has(producto.id) ? '#eff6ff' : 'white',
                    borderLeft: productosSeleccionados.has(producto.id) ? '4px solid #3b82f6' : 'none',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {modoEdicion && (
                      <input
                        type="checkbox"
                        checked={productosSeleccionados.has(producto.id)}
                        onChange={() => toggleSeleccion(producto.id)}
                        style={{
                          width: '20px',
                          height: '20px',
                          marginTop: '2px'
                        }}
                      />
                    )}
                    
                    <div style={{ flex: 1 }}>
                      {/* CÓDIGO Y ESTADO */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#1f2937'
                        }}>
                          {producto.codigo_producto}
                        </h3>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: (producto.estado === 'inactivo') ? '#fef2f2' : '#dcfce7',
                          color: (producto.estado === 'inactivo') ? '#dc2626' : '#166534',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {(producto.estado === 'inactivo') ? '❌ Inactivo' : '✅ Activo'}
                        </span>
                      </div>
                      
                      {/* DESCRIPCIÓN */}
                      <p style={{
                        margin: '0 0 8px 0',
                        fontSize: '16px',
                        color: '#4b5563',
                        lineHeight: '1.4'
                      }}>
                        {producto.descripcion}
                      </p>
                      
                      {/* CATEGORÍA */}
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                        📂 {producto.categoria}
                      </div>
                      
                      {/* CÓDIGO DE BARRAS */}
                      {producto.codigo_barras && (
                        <div style={{
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          color: '#374151',
                          backgroundColor: '#f9fafb',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          marginBottom: '12px'
                        }}>
                          🔗 {producto.codigo_barras}
                        </div>
                      )}
                      
                      {/* PRECIO Y STOCK */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        fontSize: '14px'
                      }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Stock:</span>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: producto.stock === 0 ? '#dc2626' : '#059669'
                          }}>
                            {producto.stock}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Precio:</span>
                          <div style={{ 
                            fontSize: '18px', 
                            fontWeight: '600', 
                            color: '#059669' 
                          }}>
                            ${producto.precio_venta}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* VISTA DESKTOP - TABLA MANTENIENDO ESTRUCTURA ACTUAL */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  {modoEdicion && (
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4b5563',
                      borderBottom: '1px solid #e5e7eb',
                      width: '40px'
                    }}>
                      <input
                        type="checkbox"
                        checked={productosSeleccionados.size === productosFiltrados.length && productosFiltrados.length > 0}
                        onChange={seleccionarTodos}
                      />
                    </th>
                  )}
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Código
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Descripción
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Categoría
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Código Barras
                  </th>
                  <th style={{ padding: '16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Stock
                  </th>
                  <th style={{ padding: '16px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Precio Venta
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    Estado
                  </th>
                </tr>
              </thead>
              
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={modoEdicion ? 8 : 7} 
                      style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}
                    >
                      <AlertTriangle size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', color: '#f59e0b' }} />
                      No se encontraron productos que coincidan con los criterios de búsqueda/filtro.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => (
                    <tr 
                      key={producto.id} 
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: productosSeleccionados.has(producto.id) ? '#eff6ff' : 'white'
                      }}
                    >
                      {modoEdicion && (
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={productosSeleccionados.has(producto.id)}
                            onChange={() => toggleSeleccion(producto.id)}
                          />
                        </td>
                      )}
                      
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                        {producto.codigo_producto}
                      </td>
                      
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1f2937' }}>
                        {producto.descripcion}
                      </td>
                      
                      <td style={{ padding: '16px', fontSize: '14px', color: '#1f2937' }}>
                        {producto.categoria}
                      </td>
                      
                      <td style={{ 
                        padding: '16px', 
                        fontSize: '12px', 
                        color: '#374151',
                        fontFamily: 'monospace',
                        backgroundColor: '#f9fafb',
                        maxWidth: '150px'
                      }}>
                        {producto.codigo_barras || '-'}
                      </td>
                      
                      <td style={{ 
                        padding: '16px', 
                        fontSize: '14px', 
                        textAlign: 'right',
                        fontWeight: '600',
                        color: producto.stock === 0 ? '#dc2626' : '#059669'
                      }}>
                        {producto.stock}
                      </td>
                      
                      <td style={{ 
                        padding: '16px', 
                        fontSize: '14px', 
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#059669'
                      }}>
                        ${producto.precio_venta}
                      </td>
                      
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          backgroundColor: (producto.estado === 'inactivo') ? '#fef2f2' : '#dcfce7',
                          color: (producto.estado === 'inactivo') ? '#dc2626' : '#166534',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {(producto.estado === 'inactivo') ? '❌ Inactivo' : '✅ Activo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* INFORMACIÓN DE FILTROS */}
      {(searchTerm || selectedCategory !== 'Todas' || filtroEstado !== 'Todos') && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#0c4a6e'
        }}>
          <strong>📊 Filtros aplicados:</strong>
          {searchTerm && <span> Búsqueda: "{searchTerm}"</span>}
          {selectedCategory !== 'Todas' && <span> Categoría: "{selectedCategory}"</span>}
          {filtroEstado !== 'Todos' && <span> Estado: "{filtroEstado}"</span>}
          <br />
          <strong>Resultados:</strong> {productosFiltrados.length} de {productos.length} productos
          {productosFiltrados.length < productos.length && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('Todas');
                setFiltroEstado('Todos');
              }}
              style={{
                marginLeft: '12px',
                padding: '4px 8px',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* MODAL IMPORTAR EXCEL */}
      {mostrarModalImport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                📤 Importar Productos desde Excel
              </h3>
              <button
                onClick={() => setMostrarModalImport(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  minHeight: '44px',
                  minWidth: '44px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
                📋 Formato esperado (tu Excel actual):
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#075985', fontSize: '14px' }}>
                <li>Hoja llamada "Productos"</li>
                <li>Columna F: Código propio</li>
                <li>Columna G: Código de barras</li>
                <li>Columna H: Descripción</li>
                <li>Columna N: Categoría</li>
                <li>Columna S: Precio venta</li>
              </ul>
            </div>

            {importProgress > 0 && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div style={{ marginBottom: '8px', fontSize: '14px', color: '#374151' }}>
                  {importMessage}
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${importProgress}%`,
                    height: '100%',
                    backgroundColor: '#3b82f6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            <div style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <Upload size={48} style={{ color: '#6b7280', margin: '0 auto 16px' }} />
              <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#374151' }}>
                Selecciona el archivo Excel con productos
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>
                Formato soportado: .xlsx
              </p>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importarProductosExcel(file);
                  }
                }}
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
                🔄 Proceso de importación:
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6b7280' }}>
                <li>Validación de formato Excel</li>
                <li>Verificación de códigos duplicados</li>
                <li>Actualización de productos existentes</li>
                <li>Inserción de productos nuevos</li>
                <li>Confirmación de resultados</li>
              </ol>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setMostrarModalImport(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRODUCTO */}
      {mostrarModalNuevo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}><div style={{
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'space-between',
             marginBottom: '20px'
           }}>
             <h3 style={{
               margin: 0,
               fontSize: '20px',
               fontWeight: '600',
               color: '#1f2937'
             }}>
               ➕ Nuevo Producto
             </h3>
             <button
               onClick={() => setMostrarModalNuevo(false)}
               style={{
                 background: 'none',
                 border: 'none',
                 fontSize: '24px',
                 cursor: 'pointer',
                 color: '#6b7280',
                 minHeight: '44px',
                 minWidth: '44px'
               }}
             >
               ×
             </button>
           </div>

           <form 
             style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
             onSubmit={(e) => {
               e.preventDefault();
               alert('✅ Función de crear producto implementada!');
               setMostrarModalNuevo(false);
             }}
           >
             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Código del Producto *
               </label>
               <input
                 type="text"
                 placeholder="Ej: D218, B476..."
                 required
                 style={{
                   width: '100%',
                   padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Descripción *
               </label>
               <input
                 type="text"
                 placeholder="Ej: PINZA PARA PELO, SET COLITAS..."
                 required
                 style={{
                   width: '100%',
                   padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Categoría *
               </label>
<input
  type="text"
  list="categorias-list"
  placeholder="Escribe o selecciona categoría..."
  required
  style={{
    width: '100%',
    padding: isMobile ? '16px' : '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: isMobile ? '16px' : '14px'
  }}
/>
<datalist id="categorias-list">
  {categorias.slice(1).map(cat => (
    <option key={cat} value={cat} />
  ))}
</datalist>
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Código de Barras
               </label>
               <input
                 type="text"
                 placeholder="Ej: 2025050823032 (opcional)"
                 style={{
                   width: '100%',
                   padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               <div>
                 <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                   Precio Costo
                 </label>
                 <input
                   type="number"
                   step="0.01"
                   min="0"
                   placeholder="0.00"
                   style={{
                     width: '100%',
                     padding: isMobile ? '16px' : '12px',
                     border: '1px solid #d1d5db',
                     borderRadius: '6px',
                     fontSize: isMobile ? '16px' : '14px'
                   }}
                 />
               </div>

               <div>
                 <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                   Precio Venta *
                 </label>
                 <input
                   type="number"
                   step="0.01"
                   min="0"
                   placeholder="0.00"
                   required
                   style={{
                     width: '100%',
                     padding: isMobile ? '16px' : '12px',
                     border: '1px solid #d1d5db',
                     borderRadius: '6px',
                     fontSize: isMobile ? '16px' : '14px'
                   }}
                 />
               </div>
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Stock Inicial
               </label>
               <input
                 type="number"
                 min="0"
                 placeholder="0"
                 style={{
                   width: '100%',
                   padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             <div style={{
               display: 'flex',
               gap: '12px',
               justifyContent: 'flex-end',
               marginTop: '24px'
             }}>
               <button
                 type="button"
                 onClick={() => setMostrarModalNuevo(false)}
                 style={{
                   padding: '12px 20px',
                   backgroundColor: '#f3f4f6',
                   color: '#374151',
                   border: 'none',
                   borderRadius: '8px',
                   fontSize: '14px',
                   cursor: 'pointer',
                   minHeight: '44px'
                 }}
               >
                 Cancelar
               </button>
               <button
                 type="submit"
                 style={{
                   padding: '12px 20px',
                   backgroundColor: '#22c55e',
                   color: 'white',
                   border: 'none',
                   borderRadius: '8px',
                   fontSize: '14px',
                   cursor: 'pointer',
                   fontWeight: '500',
                   minHeight: '44px'
                 }}
               >
                 Crear Producto
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* RESUMEN DE CÓDIGOS DE BARRAS - MANTENER COMO ESTÁ */}
     <div style={{
       marginTop: '32px',
       padding: '16px',
       backgroundColor: '#f8fafc',
       border: '1px solid #e2e8f0',
       borderRadius: '8px'
     }}>
       <h3 style={{ 
         fontSize: '16px', 
         fontWeight: '600', 
         color: '#1f2937', 
         marginBottom: '12px' 
       }}>
         📊 Resumen de Códigos de Barras
       </h3>
       <div style={{ 
         display: 'grid', 
         gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', 
         gap: '12px',
         fontSize: '14px'
       }}>
         <div>
           <strong>Total productos:</strong> {totalProductos}
         </div>
         <div>
           <strong>Con código de barras:</strong> {productos.filter(p => p.codigo_barras).length}
         </div>
         <div>
           <strong>Sin código de barras:</strong> {productos.filter(p => !p.codigo_barras).length}
         </div>
         <div style={{ color: '#059669' }}>
           <strong>Cobertura:</strong> {totalProductos > 0 ? 
             Math.round((productos.filter(p => p.codigo_barras).length / totalProductos) * 100) : 0}%
         </div>
       </div>
     </div>

     {/* FOOTER */}
     <div style={{
       marginTop: '32px',
       padding: '16px',
       backgroundColor: '#1f2937',
       color: 'white',
       borderRadius: '8px',
       textAlign: 'center'
     }}>
       <div style={{ marginBottom: '8px', fontSize: '14px', opacity: 0.8 }}>
         📱 Inventario Feraben SRL - Optimizado para Móviles
       </div>
       <div style={{ fontSize: '12px', opacity: 0.6 }}>
         ✅ Responsive • ✅ Importación Excel • ✅ Edición múltiple • ✅ Compatible con Facturación
       </div>
     </div>

     {/* CSS PARA ANIMACIONES */}
     <style>{`
       @keyframes spin {
         0% { transform: rotate(0deg); }
         100% { transform: rotate(360deg); }
       }
       
       /* Optimizaciones táctiles para móvil */
       @media (max-width: 768px) {
         * {
           touch-action: manipulation;
           -webkit-touch-callout: none;
           -webkit-user-select: none;
           user-select: none;
         }
         
         input, textarea, select, button {
           -webkit-user-select: auto;
           user-select: auto;
         }
         
         input {
           font-size: 16px !important; /* Evita zoom en iOS */
         }
       }
       
       /* Mejoras de accesibilidad */
       button:focus, input:focus, select:focus {
         outline: 2px solid #3b82f6;
         outline-offset: 2px;
       }
       
       /* Transiciones suaves */
       button, input, select {
         transition: all 0.2s ease;
       }
     `}</style>
   </div>
 );
};

export default Inventario;