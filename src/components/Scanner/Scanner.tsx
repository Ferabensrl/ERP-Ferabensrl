import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  Camera, 
  Search, 
  Package, 
  Check, 
  X, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  Zap, 
  Smartphone,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { productosService } from '../../lib/supabaseClient';

// INTERFACES PARA EL ESCÁNER - ✅ ACTUALIZADAS PARA COINCIDIR CON productosService
interface ProductoEscaneado {
  id: number;
  codigo_producto: string;
  descripcion: string;
  categoria: string;
  precio_venta: number;
  precio_costo?: number;
  stock: number;
  codigo_barras?: string;
  activo: boolean; // ✅ CAMBIO: activo en lugar de estado
  fecha_escaneado: Date;
  accion_realizada?: 'encontrado' | 'actualizado' | 'creado';
}

interface ProductoNuevo {
  codigo_producto: string;
  descripcion: string;
  categoria: string;
  precio_venta: number;
  precio_costo: number;
  stock: number;
  codigo_barras: string;
  activo: boolean; // ✅ CAMBIO: activo boolean en lugar de estado string
}

interface HistorialEscaneo {
  codigo_barras: string;
  timestamp: Date;
  accion: 'encontrado' | 'no_encontrado' | 'error';
  producto?: ProductoEscaneado;
}

const Scanner: React.FC = () => {
  // ESTADOS PRINCIPALES
  const [isMobile, setIsMobile] = useState(false);
  const [modoOperacion, setModoOperacion] = useState<'escanear' | 'buscar' | 'alta'>('escanear');
  
  // ESTADOS DEL ESCÁNER
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // ESTADOS DE PRODUCTOS
  const [productoEncontrado, setProductoEncontrado] = useState<ProductoEscaneado | null>(null);
  const [productosEscaneados, setProductosEscaneados] = useState<ProductoEscaneado[]>([]);
  const [historialEscaneos, setHistorialEscaneos] = useState<HistorialEscaneo[]>([]);
  
  // ESTADOS DE BÚSQUEDA Y CARGA
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarModalAlta, setMostrarModalAlta] = useState(false);
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  
  // ESTADO PARA ALTA RÁPIDA - ✅ ACTUALIZADO
  const [nuevoProducto, setNuevoProducto] = useState<Partial<ProductoNuevo>>({
    codigo_barras: '',
    activo: true
  });
  
  // ESTADO PARA ACTUALIZACIÓN DE STOCK
  const [stockUpdate, setStockUpdate] = useState({
    tipo: 'entrada' as 'entrada' | 'salida',
    cantidad: 0,
    motivo: ''
  });

  // REFERENCIAS
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // DETECCIÓN DE MÓVIL
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // CLEANUP DEL ESCÁNER AL DESMONTAR
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch (error) {
          console.log('Scanner cleanup:', error);
        }
      }
    };
  }, []);
  // VALIDACIÓN DE CÓDIGO EAN13
  const validarEAN13 = (codigo: string): boolean => {
    // Verificar que sea exactamente 13 dígitos
    if (!/^\d{13}$/.test(codigo)) {
      return false;
    }
    
    // Algoritmo de verificación EAN13
    const digits = codigo.split('').map(Number);
    const checksum = digits.pop(); // Último dígito
    
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    
    const calculatedChecksum = (10 - (sum % 10)) % 10;
    return calculatedChecksum === checksum;
  };

  // ✅ BUSCAR PRODUCTO USANDO productosService - INTEGRACIÓN COMPLETA
  const buscarProducto = async (codigo: string): Promise<ProductoEscaneado | null> => {
    try {
      setLoading(true);
      console.log(`🔍 Scanner: Buscando producto con código: "${codigo}"`);
      
      // ✅ PRIMERA BÚSQUEDA: Por código de producto usando productosService
      let producto = await productosService.getByCodigo(codigo);
      
      // ✅ SEGUNDA BÚSQUEDA: Si no se encuentra, buscar por código de barras
      if (!producto) {
        console.log(`🔍 Scanner: No encontrado por código, buscando por código de barras...`);
        
        // Obtener todos los productos y buscar por código de barras
        const todosLosProductos = await productosService.getAll();
        const productoPorBarras = todosLosProductos.find(p => 
          p.codigo_barras && p.codigo_barras === codigo
        );
        
        if (productoPorBarras) {
          producto = productoPorBarras;
          console.log(`✅ Scanner: Producto encontrado por código de barras`);
        }
      } else {
        console.log(`✅ Scanner: Producto encontrado por código de producto`);
      }
      
      // ✅ CONVERTIR A FORMATO DEL SCANNER
      if (producto) {
        const productoEscaneado: ProductoEscaneado = {
          id: producto.id,
          codigo_producto: producto.codigo_producto,
          descripcion: producto.descripcion,
          categoria: producto.categoria,
          precio_venta: producto.precio_venta,
          precio_costo: producto.precio_costo,
          stock: producto.stock,
          codigo_barras: producto.codigo_barras,
          activo: producto.activo,
          fecha_escaneado: new Date(),
          accion_realizada: 'encontrado'
        };
        
        console.log(`✅ Scanner: Producto convertido para scanner:`, productoEscaneado);
        return productoEscaneado;
      }
      
      console.log(`⚠️ Scanner: Producto no encontrado en inventario`);
      return null;
      
    } catch (error) {
      console.error('❌ Scanner: Error en búsqueda:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 🚀 SCANNER PROFESIONAL SAMSUNG S23 - VERSIÓN DEFINITIVA
  const iniciarEscaner = async () => {
    try {
      setScannerError(null);
      setShowCamera(true);
      setIsScanning(true);
      
      console.log('🔍 Iniciando scanner profesional para Samsung S23...');

      // ✅ VERIFICAR PERMISOS PRIMERO
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a cámara.');
      }

      // ✅ SOLICITAR PERMISOS EXPLÍCITAMENTE
      try {
        console.log('📷 Verificando permisos de cámara...');
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        testStream.getTracks().forEach(track => track.stop());
        console.log('✅ Permisos de cámara confirmados');
      } catch (permissionError) {
        console.error('❌ Error de permisos:', permissionError);
        throw new Error('Se necesitan permisos de cámara para usar el scanner.');
      }
      
      // ✅ IMPORTAR html5-qrcode LIBRERÍA PROFESIONAL
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      
      // ✅ ESPERAR A QUE EL DOM ESTÉ LISTO
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // ✅ VERIFICAR QUE EL ELEMENTO EXISTE
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) {
        throw new Error('Elemento scanner no encontrado. Recarga la página.');
      }
      
      console.log('✅ Elemento qr-reader encontrado, iniciando scanner...');
      
      // 🎯 CONFIGURACIÓN QUE FUNCIONABA + FIX DE CÓDIGOS
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 5,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0,
          // ✅ SOLO LOS 2 TIPOS PERMITIDOS (este era el único problema)
          supportedScanTypes: [1], // Solo códigos de barras (incluye EAN-13)
          rememberLastUsedCamera: false,
          showTorchButtonIfSupported: false,
          showZoomSliderIfSupported: false,
          videoConstraints: {
            facingMode: "environment"
          }
        },
        false
      );
      
      scannerRef.current = scanner;
      
      scanner.render(
        async (decodedText: string) => {
          // ✅ CÓDIGO ESCANEADO EXITOSAMENTE
          console.log('🎯 Código detectado:', decodedText);
          
          setLastScannedCode(decodedText);
          
          // Agregar al historial
          const nuevoHistorial: HistorialEscaneo = {
            codigo_barras: decodedText,
            timestamp: new Date(),
            accion: 'encontrado'
          };
          
          // ✅ BUSCAR PRODUCTO INMEDIATAMENTE
          const producto = await buscarProducto(decodedText);
          
          if (producto) {
            setProductoEncontrado(producto);
            
            // Agregar a productos escaneados
            setProductosEscaneados(prev => {
              const existe = prev.find(p => p.codigo_barras === decodedText || p.codigo_producto === decodedText);
              if (!existe) {
                return [producto, ...prev.slice(0, 9)];
              }
              return prev;
            });
            
            nuevoHistorial.accion = 'encontrado';
            nuevoHistorial.producto = producto;
            
            // ✅ FEEDBACK VISUAL + SONORO
            navigator.vibrate && navigator.vibrate([100]); // Vibración en móvil
            
          } else {
            setProductoEncontrado(null);
            nuevoHistorial.accion = 'no_encontrado';
            
            // Pre-cargar para alta rápida
            setNuevoProducto(prev => ({
              ...prev,
              codigo_barras: decodedText
            }));
            
            // Vibración diferente para "no encontrado"
            navigator.vibrate && navigator.vibrate([50, 50, 50]);
          }
          
          setHistorialEscaneos(prev => [nuevoHistorial, ...prev.slice(0, 19)]);
          
          // ✅ NO DETENER AUTOMÁTICAMENTE - Permitir múltiples escaneos
          // detenerEscaner();
          
        },
        (errorMessage: string) => {
          // Errores normales de escaneo - no mostrar al usuario
          if (!errorMessage.includes('NotFoundException')) {
            console.log('Scanner info:', errorMessage);
          }
        }
      );
      
    } catch (error) {
      console.error('❌ Error iniciando escáner:', error);
      setScannerError(`Error: ${error}`);
      setShowCamera(false);
      setIsScanning(false);
    }
  };

  // ✅ DETENER ESCÁNER PROFESIONAL
  const detenerEscaner = () => {
    try {
      if (scannerRef.current) {
        // ✅ LIMPIAR html5-qrcode scanner
        if (scannerRef.current.clear) {
          scannerRef.current.clear();
        }
        scannerRef.current = null;
      }
      
      setShowCamera(false);
      setIsScanning(false);
      console.log('🔴 Scanner detenido');
    } catch (error) {
      console.log('Info deteniendo escáner:', error);
      // Forzar limpieza
      setShowCamera(false);
      setIsScanning(false);
    }
  };

  // BÚSQUEDA MANUAL
  const buscarManual = async () => {
    if (!searchTerm.trim()) return;
    
    const producto = await buscarProducto(searchTerm.trim());
    setProductoEncontrado(producto);
    setLastScannedCode(searchTerm.trim());
    
    if (producto) {
      setProductosEscaneados(prev => {
        const existe = prev.find(p => p.codigo_producto === producto.codigo_producto);
        if (!existe) {
          return [producto, ...prev.slice(0, 9)];
        }
        return prev;
      });
    }
  };
  // ✅ CREAR PRODUCTO NUEVO USANDO SUPABASE DIRECTAMENTE (productosService no tiene función create)
  const crearProductoNuevo = async () => {
    try {
      if (!nuevoProducto.codigo_producto || !nuevoProducto.descripcion || !nuevoProducto.categoria || !nuevoProducto.precio_venta) {
        alert('❌ Completa todos los campos obligatorios');
        return;
      }

      setLoading(true);
      console.log(`🆕 Scanner: Creando nuevo producto:`, nuevoProducto);

      // ✅ PRODUCTO CON ESTRUCTURA ACTUALIZADA
      const productoParaInsertar = {
        codigo_producto: nuevoProducto.codigo_producto,
        descripcion: nuevoProducto.descripcion,
        categoria: nuevoProducto.categoria,
        precio_venta: nuevoProducto.precio_venta,
        precio_costo: nuevoProducto.precio_costo || 0,
        stock: nuevoProducto.stock || 0,
        codigo_barras: nuevoProducto.codigo_barras,
        activo: true, // ✅ CAMBIO: activo boolean
        stock_minimo: 5 // ✅ AGREGAR stock_minimo por defecto
      };

      // ✅ IMPORTAR SUPABASE PARA INSERCIÓN (productosService no tiene create)
      const { supabase } = await import('../../lib/supabaseClient');
      
      const { data, error } = await supabase
        .from('inventario')
        .insert([productoParaInsertar])
        .select()
        .single();

      if (error) {
        console.error('❌ Scanner: Error creando producto:', error);
        alert(`❌ Error: ${error.message}`);
        return;
      }

      console.log(`✅ Scanner: Producto creado exitosamente:`, data);

      // ✅ CONVERTIR A FORMATO DEL SCANNER
      const nuevoProductoCreado: ProductoEscaneado = {
        id: data.id,
        codigo_producto: data.codigo_producto,
        descripcion: data.descripcion,
        categoria: data.categoria,
        precio_venta: data.precio_venta,
        precio_costo: data.precio_costo,
        stock: data.stock,
        codigo_barras: data.codigo_barras,
        activo: data.activo,
        fecha_escaneado: new Date(),
        accion_realizada: 'creado'
      };

      setProductoEncontrado(nuevoProductoCreado);
      setProductosEscaneados(prev => [nuevoProductoCreado, ...prev.slice(0, 9)]);

      // Limpiar formulario
      setNuevoProducto({
        codigo_barras: '',
        activo: true
      });

      setMostrarModalAlta(false);
      
      // ✅ NOTIFICACIÓN MEJORADA
      alert(`✅ Producto creado exitosamente!\n\n📦 Código: ${data.codigo_producto}\n🏷️ Descripción: ${data.descripcion}\n💰 Precio: $${data.precio_venta}\n📊 Stock inicial: ${data.stock}`);

    } catch (error) {
      console.error('❌ Scanner: Error inesperado creando producto:', error);
      alert('❌ Error inesperado creando producto');
    } finally {
      setLoading(false);
    }
  };

  // ✅ ACTUALIZAR STOCK USANDO productosService - INTEGRACIÓN COMPLETA
  const actualizarStock = async () => {
    if (!productoEncontrado || !stockUpdate.cantidad || stockUpdate.cantidad <= 0) {
      alert('❌ Ingresa una cantidad válida');
      return;
    }

    try {
      setLoading(true);
      console.log(`🔄 Scanner: Actualizando stock para producto ${productoEncontrado.codigo_producto}`);

      const stockAnterior = productoEncontrado.stock;
      const nuevoStock = stockUpdate.tipo === 'entrada' 
        ? stockAnterior + stockUpdate.cantidad
        : Math.max(0, stockAnterior - stockUpdate.cantidad);

      console.log(`📦 Scanner: ${stockUpdate.tipo} de ${stockUpdate.cantidad} unidades`);
      console.log(`📊 Scanner: Stock ${stockAnterior} → ${nuevoStock}`);

      // ✅ USAR productosService.updateStock en lugar de consulta directa
      await productosService.updateStock(productoEncontrado.id, nuevoStock);

      console.log(`✅ Scanner: Stock actualizado exitosamente en Supabase`);

      // Actualizar producto local
      const productoActualizado = {
        ...productoEncontrado,
        stock: nuevoStock,
        accion_realizada: 'actualizado' as const
      };

      setProductoEncontrado(productoActualizado);
      
      // Actualizar en lista de escaneados
      setProductosEscaneados(prev => 
        prev.map(p => 
          p.id === productoEncontrado.id 
            ? productoActualizado 
            : p
        )
      );

      // Limpiar formulario
      setStockUpdate({
        tipo: 'entrada',
        cantidad: 0,
        motivo: ''
      });

      setMostrarModalStock(false);
      
      // ✅ NOTIFICACIÓN MEJORADA CON DETALLES
      alert(`✅ Stock actualizado exitosamente!\n\n📦 Producto: ${productoEncontrado.codigo_producto}\n🔄 ${stockUpdate.tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${stockUpdate.cantidad} unidades\n📊 Stock anterior: ${stockAnterior}\n📊 Stock nuevo: ${nuevoStock}${stockUpdate.motivo ? `\n📝 Motivo: ${stockUpdate.motivo}` : ''}`);

    } catch (error) {
      console.error('❌ Scanner: Error actualizando stock:', error);
      alert(`❌ Error actualizando stock: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // LIMPIAR RESULTADOS
  const limpiarResultados = () => {
    setProductosEscaneados([]);
    setHistorialEscaneos([]);
    setProductoEncontrado(null);
    setLastScannedCode('');
    setSearchTerm('');
    setScannerError(null);
  };

  // ✅ OBTENER CATEGORÍAS USANDO productosService
  const [categorias, setCategorias] = useState<string[]>(['Accesorios para pelo', 'Billeteras de dama', 'Reloj hombre']);

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        console.log('📂 Scanner: Cargando categorías...');
        
        // ✅ USAR productosService.getAll en lugar de consulta directa
        const productos = await productosService.getAll();
        
        if (productos) {
          const categoriasUnicas = Array.from(new Set(
            productos
              .map(producto => producto.categoria)
              .filter(categoria => categoria && categoria.trim() !== '')
          ));
          
          setCategorias(categoriasUnicas);
          console.log(`✅ Scanner: ${categoriasUnicas.length} categorías cargadas:`, categoriasUnicas);
        }
      } catch (error) {
        console.error('❌ Scanner: Error cargando categorías:', error);
      }
    };
    
    cargarCategorias();
  }, []);
  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: isMobile ? '12px' : '24px',
      maxWidth: isMobile ? '100%' : '800px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
      {/* HEADER OPTIMIZADO PARA MÓVIL */}
      <div style={{ 
        marginBottom: isMobile ? '16px' : '24px',
        textAlign: 'center'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <Scan size={isMobile ? 32 : 40} style={{ color: '#3b82f6' }} />
          {isMobile && <Smartphone size={28} style={{ color: '#22c55e' }} />}
        </div>
        
        <h2 style={{ 
          fontSize: isMobile ? '28px' : '32px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          margin: '0 0 8px 0' 
        }}>
          📱 Escáner Feraben SRL
        </h2>
        
        <p style={{ 
          color: '#6b7280', 
          margin: 0, 
          fontSize: isMobile ? '16px' : '18px',
          maxWidth: '400px',
          marginLeft: 'auto',
marginRight: 'auto'
        }}>
          Sistema profesional para gestión de productos con códigos EAN13
        </p>
      </div>

      {/* ESTADÍSTICAS RÁPIDAS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '12px' : '16px',
        marginBottom: isMobile ? '16px' : '24px'
      }}>
        <div style={{
          backgroundColor: '#f0f9ff',
          padding: isMobile ? '12px' : '16px',
          borderRadius: '12px',
          border: '1px solid #0ea5e9',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#0c4a6e' }}>
            {productosEscaneados.length}
          </div>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#075985' }}>
            Productos Escaneados
          </div>
        </div>

        <div style={{
          backgroundColor: '#f0fdf4',
          padding: isMobile ? '12px' : '16px',
          borderRadius: '12px',
          border: '1px solid #22c55e',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#166534' }}>
            {historialEscaneos.filter(h => h.accion === 'encontrado').length}
          </div>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#15803d' }}>
            Exitosos
          </div>
        </div>

        <div style={{
          backgroundColor: '#fef3c7',
          padding: isMobile ? '12px' : '16px',
          borderRadius: '12px',
          border: '1px solid #f59e0b',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#92400e' }}>
            {historialEscaneos.filter(h => h.accion === 'no_encontrado').length}
          </div>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#b45309' }}>
            No Encontrados
          </div>
        </div>

        <div style={{
          backgroundColor: '#fef2f2',
          padding: isMobile ? '12px' : '16px',
          borderRadius: '12px',
          border: '1px solid #f87171',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#dc2626' }}>
            {historialEscaneos.filter(h => h.accion === 'error').length}
          </div>
          <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#b91c1c' }}>
            Errores
          </div>
        </div>
      </div>

      {/* SELECTOR DE MODO DE OPERACIÓN */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        marginBottom: isMobile ? '16px' : '20px'
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: isMobile ? '18px' : '20px', 
          fontWeight: '600', 
          color: '#1f2937' 
        }}>
          🎯 Modo de Operación
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '8px'
        }}>
          <button
            onClick={() => setModoOperacion('escanear')}
            style={{
              padding: isMobile ? '18px' : '14px',
              backgroundColor: modoOperacion === 'escanear' ? '#3b82f6' : '#f3f4f6',
              color: modoOperacion === 'escanear' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              minHeight: '48px'
            }}
          >
            <Camera size={isMobile ? 24 : 20} />
            Escanear
          </button>
          
          <button
            onClick={() => setModoOperacion('buscar')}
            style={{
              padding: isMobile ? '18px' : '14px',
              backgroundColor: modoOperacion === 'buscar' ? '#3b82f6' : '#f3f4f6',
              color: modoOperacion === 'buscar' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              minHeight: '48px'
            }}
          >
            <Search size={isMobile ? 24 : 20} />
            Buscar
          </button>
          
          <button
            onClick={() => setModoOperacion('alta')}
            style={{
              padding: isMobile ? '18px' : '14px',
              backgroundColor: modoOperacion === 'alta' ? '#3b82f6' : '#f3f4f6',
              color: modoOperacion === 'alta' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              minHeight: '48px'
            }}
          >
            <Plus size={isMobile ? 24 : 20} />
            Alta Rápida
          </button>
        </div>
      </div>
      {/* PANEL PRINCIPAL SEGÚN EL MODO */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: isMobile ? '20px' : '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: isMobile ? '16px' : '20px'
      }}>
        {/* MODO ESCANEAR - HÍBRIDO MANUAL + CÁMARA */}
        {modoOperacion === 'escanear' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: isMobile ? '20px' : '24px', 
              fontWeight: '600', 
              color: '#1f2937' 
            }}>
              📱 Scanner EAN13 Profesional
            </h3>

            {/* ✅ SCANNER MANUAL PRINCIPAL - SIEMPRE VISIBLE */}
            <div style={{
              backgroundColor: '#f0f9ff',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                fontSize: '18px', 
                color: '#1e40af',
                fontWeight: '600'
              }}>
                🎯 Ingreso Manual de Código
              </h4>
              
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                maxWidth: '400px', 
                margin: '0 auto',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <input
                  type="text"
                  placeholder="Código EAN13 o código producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && buscarManual()}
                  style={{
                    flex: 1,
                    padding: isMobile ? '16px' : '14px',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: isMobile ? '16px' : '14px',
                    outline: 'none',
                    textAlign: 'center',
                    fontWeight: '600'
                  }}
                  autoFocus
                />
                <button
                  onClick={buscarManual}
                  disabled={!searchTerm.trim() || loading}
                  style={{
                    padding: isMobile ? '16px 24px' : '14px 20px',
                    backgroundColor: (!searchTerm.trim() || loading) ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: '600',
                    cursor: (!searchTerm.trim() || loading) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    minWidth: isMobile ? '100%' : '120px'
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      BUSCAR
                    </>
                  )}
                </button>
              </div>
              
              <p style={{ 
                margin: '12px 0 0 0', 
                color: '#1e40af', 
                fontSize: '14px',
                fontStyle: 'italic'
              }}>
                💡 Escribe el código y presiona Enter o toca Buscar
              </p>
            </div>

            {/* SEPARADOR */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '20px 0',
              color: '#6b7280'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
              <span style={{ padding: '0 16px', fontSize: '14px', fontWeight: '500' }}>O</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }}></div>
            </div>

            {/* ÁREA DE ESCANEO CON CÁMARA - SECUNDARIA */}
            <div style={{
              width: isMobile ? '280px' : '320px',
              height: isMobile ? '200px' : '240px',
              margin: '0 auto 24px',
              border: showCamera ? 'none' : '2px dashed #6b7280',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: showCamera ? '#000' : '#f9fafb',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* ✅ CONTENEDOR DEL SCANNER SIEMPRE PRESENTE */}
              <div id="qr-reader" style={{ 
                width: '100%', 
                height: '100%',
                display: showCamera ? 'block' : 'flex',
                alignItems: showCamera ? 'initial' : 'center',
                justifyContent: showCamera ? 'initial' : 'center'
              }}>
                {/* ✅ CONTENIDO CUANDO NO HAY SCANNER ACTIVO */}
                {!showCamera && (
                  <div style={{ textAlign: 'center' }}>
                    <Camera size={isMobile ? 48 : 64} style={{ color: '#6b7280', marginBottom: '12px' }} />
                    <p style={{ margin: 0, color: '#6b7280', fontSize: isMobile ? '14px' : '16px' }}>
                      Scanner con Cámara (Opcional)
                    </p>
                    <p style={{ margin: '6px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
                      Si no funciona, usa el ingreso manual ↑
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ERROR DEL ESCÁNER */}
            {scannerError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                  <AlertCircle size={20} />
                  <span style={{ fontSize: '14px' }}>{scannerError}</span>
                </div>
              </div>
            )}

            {/* BOTONES DE CONTROL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!showCamera ? (
                <button
                  onClick={iniciarEscaner}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: isMobile ? '18px' : '14px 24px',
                    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    minHeight: '52px'
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid white',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Zap size={isMobile ? 28 : 24} />
                      Activar Escáner
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={detenerEscaner}
                  style={{
                    width: '100%',
                    padding: isMobile ? '18px' : '14px 24px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    minHeight: '52px'
                  }}
                >
                  <X size={isMobile ? 28 : 24} />
                  Detener Escáner
                </button>
              )}

              {/* BOTÓN DE SIMULACIÓN PARA TESTING */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={async () => {
                    const codigoTest = '2025050823032';
                    setLastScannedCode(codigoTest);
                    const producto = await buscarProducto(codigoTest);
                    setProductoEncontrado(producto);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🧪 Simular Escaneo (Desarrollo)
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODO BUSCAR */}
        {modoOperacion === 'buscar' && (
          <div>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: isMobile ? '20px' : '24px', 
              fontWeight: '600', 
              color: '#1f2937' 
            }}>
              🔍 Búsqueda Manual
            </h3>
            
            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #0ea5e9'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#0c4a6e' }}>
                💡 <strong>Busca por:</strong> Código EAN13, código de producto o descripción parcial
              </p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Código EAN13, código producto o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarManual()}
                style={{
                  width: '100%',
                  padding: isMobile ? '18px' : '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <button
              onClick={buscarManual}
              disabled={!searchTerm.trim() || loading}
              style={{
                width: '100%',
                padding: isMobile ? '18px' : '14px',
                backgroundColor: (!searchTerm.trim() || loading) ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                cursor: (!searchTerm.trim() || loading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '48px'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Buscar Producto
                </>
              )}
            </button>
          </div>
        )}

        {/* MODO ALTA RÁPIDA */}
        {modoOperacion === 'alta' && (
          <div>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: isMobile ? '20px' : '24px', 
              fontWeight: '600', 
              color: '#1f2937' 
            }}>
              ⚡ Alta Rápida de Producto
            </h3>
            
            <div style={{
              backgroundColor: '#f0fdf4',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #22c55e'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                💡 <strong>Proceso:</strong> 1) Escanea código → 2) Completa datos → 3) Guarda producto
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={iniciarEscaner}
                disabled={isScanning}
                style={{
                  padding: isMobile ? '16px' : '12px',
                  backgroundColor: isScanning ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '44px'
                }}
              >
                <Camera size={20} />
                {isScanning ? 'Escaneando...' : 'Escanear Código EAN13'}
              </button>

              {/* MOSTRAR CÓDIGO ESCANEADO */}
              {nuevoProducto.codigo_barras && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #22c55e',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                    ✅ Código EAN13 capturado:
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1f2937',
                    fontFamily: 'monospace'
                  }}>
                    {nuevoProducto.codigo_barras}
                  </div>
                </div>
              )}

              <button
                onClick={() => setMostrarModalAlta(true)}
                disabled={!nuevoProducto.codigo_barras}
                style={{
                  padding: isMobile ? '16px' : '12px',
                  backgroundColor: !nuevoProducto.codigo_barras ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  cursor: !nuevoProducto.codigo_barras ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '44px'
                }}
              >
                <Plus size={20} />
                Completar Datos del Producto
              </button>
            </div>
          </div>
        )}
      </div>
      {/* RESULTADO DEL PRODUCTO ENCONTRADO */}
      {productoEncontrado && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          marginBottom: isMobile ? '16px' : '20px',
          border: `2px solid ${productoEncontrado.accion_realizada === 'creado' ? '#22c55e' : 
                                 productoEncontrado.accion_realizada === 'actualizado' ? '#f59e0b' : '#3b82f6'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {productoEncontrado.accion_realizada === 'creado' ? (
              <CheckCircle size={28} style={{ color: '#22c55e' }} />
            ) : productoEncontrado.accion_realizada === 'actualizado' ? (
              <RotateCcw size={28} style={{ color: '#f59e0b' }} />
            ) : (
              <Check size={28} style={{ color: '#3b82f6' }} />
            )}
            
            <h3 style={{ 
              margin: 0, 
              fontSize: isMobile ? '20px' : '22px', 
              fontWeight: '600', 
              color: productoEncontrado.accion_realizada === 'creado' ? '#166534' :
                     productoEncontrado.accion_realizada === 'actualizado' ? '#92400e' : '#1e40af'
            }}>
              {productoEncontrado.accion_realizada === 'creado' ? '✅ Producto Creado' :
               productoEncontrado.accion_realizada === 'actualizado' ? '🔄 Stock Actualizado' : '✅ Producto Encontrado'}
            </h3>
          </div>

          {/* INFORMACIÓN DEL PRODUCTO PARA MÓVIL */}
          {isMobile ? (
            <div>
              {/* CÓDIGO Y PRECIO PRINCIPAL */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>CÓDIGO</label>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                    {productoEncontrado.codigo_producto}
                  </div>
                </div>
                
                <div>
                  <label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>PRECIO</label>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#059669' }}>
                    ${productoEncontrado.precio_venta}
                  </div>
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div style={{ marginBottom: '16px' }}>
<label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>DESCRIPCIÓN</label>
               <div style={{ fontSize: '18px', color: '#374151', lineHeight: '1.4', marginTop: '4px' }}>
                 {productoEncontrado.descripcion}
               </div>
             </div>

             {/* CATEGORÍA Y STOCK */}
             <div style={{
               display: 'grid',
               gridTemplateColumns: '1fr 1fr',
               gap: '16px',
               marginBottom: '16px'
             }}>
               <div>
                 <label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>CATEGORÍA</label>
                 <div style={{ fontSize: '16px', color: '#374151', marginTop: '4px' }}>
                   📂 {productoEncontrado.categoria}
                 </div>
               </div>
               
               <div>
                 <label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>STOCK</label>
                 <div style={{
                   fontSize: '20px',
                   fontWeight: '600',
                   color: productoEncontrado.stock === 0 ? '#dc2626' : '#059669',
                   marginTop: '4px'
                 }}>
                   {productoEncontrado.stock}
                 </div>
               </div>
             </div>

             {/* CÓDIGO DE BARRAS */}
             {productoEncontrado.codigo_barras && (
               <div style={{
                 backgroundColor: '#f9fafb',
                 padding: '12px',
                 borderRadius: '8px',
                 marginBottom: '16px'
               }}>
                 <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>CÓDIGO DE BARRAS EAN13</label>
                 <div style={{ 
                   fontSize: '16px', 
                   fontFamily: 'monospace', 
                   color: '#374151',
                   fontWeight: '600',
                   marginTop: '4px'
                 }}>
                   🔗 {productoEncontrado.codigo_barras}
                 </div>
               </div>
             )}

             {/* ESTADO */}
             <div style={{ marginBottom: '20px' }}>
               <label style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>ESTADO</label>
               <div style={{ marginTop: '4px' }}>
                 <span style={{
                   padding: '6px 12px',
                   backgroundColor: !productoEncontrado.activo ? '#fef2f2' : '#dcfce7',
                   color: !productoEncontrado.activo ? '#dc2626' : '#166534',
                   borderRadius: '12px',
                   fontSize: '14px',
                   fontWeight: '500'
                 }}>
                   {!productoEncontrado.activo ? '❌ Inactivo' : '✅ Activo'}
                 </span>
               </div>
             </div>
           </div>
         ) : (
           /* VISTA DESKTOP - TABLA COMPACTA */
           <div style={{
             display: 'grid',
             gridTemplateColumns: 'repeat(3, 1fr)',
             gap: '20px',
             marginBottom: '20px'
           }}>
             <div>
               <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>CÓDIGO</label>
               <div style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                 {productoEncontrado.codigo_producto}
               </div>
             </div>
             
             <div>
               <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>PRECIO</label>
               <div style={{ fontSize: '18px', fontWeight: '600', color: '#059669' }}>
                 ${productoEncontrado.precio_venta}
               </div>
             </div>

             <div>
               <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>STOCK</label>
               <div style={{
                 fontSize: '18px',
                 fontWeight: '600',
                 color: productoEncontrado.stock === 0 ? '#dc2626' : '#059669'
               }}>
                 {productoEncontrado.stock}
               </div>
             </div>

             <div style={{ gridColumn: 'span 2' }}>
               <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>DESCRIPCIÓN</label>
               <div style={{ fontSize: '16px', color: '#374151', lineHeight: '1.4' }}>
                 {productoEncontrado.descripcion}
               </div>
             </div>

             <div>
               <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>CATEGORÍA</label>
               <div style={{ fontSize: '14px', color: '#374151' }}>
                 📂 {productoEncontrado.categoria}
               </div>
             </div>

             {productoEncontrado.codigo_barras && (
               <div style={{ gridColumn: 'span 3' }}>
                 <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>CÓDIGO DE BARRAS</label>
                 <div style={{ 
                   fontSize: '14px', 
                   fontFamily: 'monospace', 
                   color: '#374151',
                   backgroundColor: '#f9fafb',
                   padding: '8px',
                   borderRadius: '4px',
                   marginTop: '4px'
                 }}>
                   🔗 {productoEncontrado.codigo_barras}
                 </div>
               </div>
             )}
           </div>
         )}

         {/* BOTONES DE ACCIÓN - ✅ AMPLIADOS CON REDUCCIÓN RÁPIDA */}
         <div style={{
           display: 'flex',
           flexDirection: isMobile ? 'column' : 'row',
           gap: '8px'
         }}>
           {/* ✅ NUEVO: Botón de reducción rápida para ventas */}
           <button
             onClick={async () => {
               const cantidad = prompt('¿Cuántas unidades se vendieron/entregaron?', '1');
               if (cantidad && parseInt(cantidad) > 0) {
                 try {
                   const cantidadNum = parseInt(cantidad);
                   if (cantidadNum > productoEncontrado.stock) {
                     if (!confirm(`⚠️ Solo hay ${productoEncontrado.stock} unidades en stock.\n¿Deseas continuar con la reducción completa?`)) {
                       return;
                     }
                   }
                   
                   const stockAnterior = productoEncontrado.stock;
                   const nuevoStock = Math.max(0, stockAnterior - cantidadNum);
                   
                   await productosService.updateStock(productoEncontrado.id, nuevoStock);
                   
                   const productoActualizado = {
                     ...productoEncontrado,
                     stock: nuevoStock,
                     accion_realizada: 'actualizado' as const
                   };
                   
                   setProductoEncontrado(productoActualizado);
                   setProductosEscaneados(prev => 
                     prev.map(p => p.id === productoEncontrado.id ? productoActualizado : p)
                   );
                   
                   alert(`✅ Venta registrada!\n\n📦 ${productoEncontrado.codigo_producto}\n🛒 Vendidas: ${cantidadNum} unidades\n📊 Stock: ${stockAnterior} → ${nuevoStock}`);
                 } catch (error) {
                   alert(`❌ Error registrando venta: ${error}`);
                 }
               }
             }}
             style={{
               flex: 1,
               padding: isMobile ? '14px' : '10px 16px',
               backgroundColor: '#10b981',
               color: 'white',
               border: 'none',
               borderRadius: '6px',
               fontSize: '14px',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '6px',
               minHeight: '44px'
             }}
           >
             <Package size={16} />
             Registrar Venta
           </button>
           
           <button
             onClick={() => setMostrarModalStock(true)}
             style={{
               flex: 1,
               padding: isMobile ? '14px' : '10px 16px',
               backgroundColor: '#f59e0b',
               color: 'white',
               border: 'none',
               borderRadius: '6px',
               fontSize: '14px',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '6px',
               minHeight: '44px'
             }}
           >
             <Edit3 size={16} />
             Actualizar Stock
           </button>
           
           <button
             onClick={() => setProductoEncontrado(null)}
             style={{
               flex: 1,
               padding: isMobile ? '14px' : '10px 16px',
               backgroundColor: '#ef4444',
               color: 'white',
               border: 'none',
               borderRadius: '6px',
               fontSize: '14px',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '6px',
               minHeight: '44px'
             }}
           >
             <X size={16} />
             Cerrar
           </button>
         </div>
       </div>
     )}

     {/* MENSAJE CUANDO NO SE ENCUENTRA PRODUCTO */}
     {!loading && lastScannedCode && !productoEncontrado && (
       <div style={{
         backgroundColor: '#fef2f2',
         borderRadius: '12px',
         padding: isMobile ? '20px' : '24px',
         border: '2px solid #f87171',
         textAlign: 'center',
         marginBottom: isMobile ? '16px' : '20px'
       }}>
         <AlertTriangle size={48} style={{ color: '#dc2626', margin: '0 auto 16px' }} />
         <h3 style={{ 
           margin: '0 0 8px 0', 
           fontSize: isMobile ? '20px' : '22px', 
           fontWeight: '600', 
           color: '#dc2626' 
         }}>
           ❌ Producto No Encontrado
         </h3>
         <div style={{
           backgroundColor: '#fecaca',
           padding: '8px 12px',
           borderRadius: '6px',
           marginBottom: '16px',
           display: 'inline-block'
         }}>
           <span style={{ fontSize: '14px', color: '#7f1d1d', fontWeight: '500' }}>
             Código: <span style={{ fontFamily: 'monospace' }}>{lastScannedCode}</span>
           </span>
         </div>
         
         <p style={{ margin: '0 0 20px 0', color: '#7f1d1d', fontSize: '16px' }}>
           El producto no existe en el inventario
         </p>
         
         <div style={{
           display: 'flex',
           flexDirection: isMobile ? 'column' : 'row',
           gap: '12px',
           justifyContent: 'center'
         }}>
           <button
             onClick={() => {
               setNuevoProducto(prev => ({
                 ...prev,
                 codigo_barras: lastScannedCode
               }));
               setModoOperacion('alta');
               setMostrarModalAlta(true);
             }}
             style={{
               padding: isMobile ? '14px 20px' : '10px 16px',
               backgroundColor: '#22c55e',
               color: 'white',
               border: 'none',
               borderRadius: '8px',
               fontSize: isMobile ? '16px' : '14px',
               fontWeight: '500',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '8px',
               minHeight: '44px'
             }}
           >
             <Plus size={20} />
             Dar de Alta
           </button>

           <button
             onClick={() => {
               setProductoEncontrado(null);
               setLastScannedCode('');
             }}
             style={{
               padding: isMobile ? '14px 20px' : '10px 16px',
               backgroundColor: '#6b7280',
               color: 'white',
               border: 'none',
               borderRadius: '8px',
               fontSize: isMobile ? '16px' : '14px',
               fontWeight: '500',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '8px',
               minHeight: '44px'
             }}
           >
             <X size={20} />
             Cerrar
           </button>
         </div>
       </div>
     )}
     {/* HISTORIAL DE PRODUCTOS ESCANEADOS */}
      {productosEscaneados.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: isMobile ? '20px' : '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          marginBottom: isMobile ? '16px' : '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: isMobile ? '18px' : '20px', 
              fontWeight: '600', 
              color: '#1f2937' 
            }}>
              📋 Productos Escaneados Hoy ({productosEscaneados.length})
            </h3>
            
            <button
              onClick={limpiarResultados}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '36px'
              }}
            >
              <Trash2 size={14} style={{ marginRight: '4px' }} />
              Limpiar
            </button>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {productosEscaneados.map((producto, index) => (
              <div
                key={`${producto.id}-${index}`}
                style={{
                  padding: isMobile ? '14px' : '12px',
                  backgroundColor: index === 0 ? '#f0f9ff' : 
                                  producto.accion_realizada === 'creado' ? '#f0fdf4' :
                                  producto.accion_realizada === 'actualizado' ? '#fffbeb' : '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: `1px solid ${index === 0 ? '#0ea5e9' : 
                                       producto.accion_realizada === 'creado' ? '#22c55e' :
                                       producto.accion_realizada === 'actualizado' ? '#f59e0b' : '#e5e7eb'}`,
                  position: 'relative'
                }}
              >
                {/* INDICADOR DE ACCIÓN */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '18px'
                }}>
                  {producto.accion_realizada === 'creado' ? '🆕' :
                   producto.accion_realizada === 'actualizado' ? '🔄' : '✅'}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1, paddingRight: '40px' }}>
                    <div style={{ 
                      fontSize: isMobile ? '16px' : '14px', 
                      fontWeight: '600', 
                      color: '#1f2937',
                      marginBottom: '4px'
                    }}>
                      {producto.codigo_producto}
                    </div>
                    <div style={{ 
                      fontSize: isMobile ? '14px' : '12px', 
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}>
                      {producto.descripcion}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af',
                      fontFamily: 'monospace'
                    }}>
                      🔗 {producto.codigo_barras}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: isMobile ? '16px' : '14px', 
                      fontWeight: '600', 
                      color: '#059669',
                      marginBottom: '4px'
                    }}>
                      ${producto.precio_venta}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: producto.stock === 0 ? '#dc2626' : '#059669',
                      fontWeight: '500'
                    }}>
                      Stock: {producto.stock}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#9ca3af'
                    }}>
                      {producto.fecha_escaneado.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* CATEGORÍA */}
                <div style={{ 
                  fontSize: '11px', 
                  color: '#6b7280',
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  📂 {producto.categoria}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL PARA ALTA DE PRODUCTO */}
      {mostrarModalAlta && (
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
                ➕ Nuevo Producto
              </h3>
              <button
                onClick={() => setMostrarModalAlta(false)}
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

            {/* CÓDIGO DE BARRAS PRE-CARGADO */}
            {nuevoProducto.codigo_barras && (
              <div style={{
                backgroundColor: '#ecfdf5',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #22c55e'
              }}>
                <div style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                  ✅ Código EAN13:
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#1f2937',
                  fontFamily: 'monospace'
                }}>
                  {nuevoProducto.codigo_barras}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Código del Producto *
                </label>
                <input
                  type="text"
                  placeholder="Ej: D218, B476..."
                  value={nuevoProducto.codigo_producto || ''}
                  onChange={(e) => setNuevoProducto(prev => ({...prev, codigo_producto: e.target.value}))}
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
                  value={nuevoProducto.descripcion || ''}
                  onChange={(e) => setNuevoProducto(prev => ({...prev, descripcion: e.target.value}))}
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
                  list="categorias-escaner"
                  placeholder="Escribe o selecciona categoría..."
                  value={nuevoProducto.categoria || ''}
                  onChange={(e) => setNuevoProducto(prev => ({...prev, categoria: e.target.value}))}
                  required
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px' : '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: isMobile ? '16px' : '14px'
                  }}
                />
                <datalist id="categorias-escaner">
                  {categorias.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
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
                    value={nuevoProducto.precio_costo || ''}
                    onChange={(e) => setNuevoProducto(prev => ({...prev, precio_costo: parseFloat(e.target.value) || 0}))}
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
                    value={nuevoProducto.precio_venta || ''}
                    onChange={(e) => setNuevoProducto(prev => ({...prev, precio_venta: parseFloat(e.target.value) || 0}))}
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
                  value={nuevoProducto.stock || ''}
                  onChange={(e) => setNuevoProducto(prev => ({...prev, stock: parseInt(e.target.value) || 0}))}
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

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '24px'
            }}>
              <button
                onClick={() => setMostrarModalAlta(false)}
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
                onClick={crearProductoNuevo}
                disabled={loading}
                style={{
                  padding: '12px 20px',
                  backgroundColor: loading ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  minHeight: '44px'
                }}
              >
                {loading ? 'Creando...' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL PARA ACTUALIZAR STOCK */}
      {mostrarModalStock && productoEncontrado && (
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
            maxWidth: '400px',
            width: '100%'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                📦 Actualizar Stock
              </h3>
              <button
                onClick={() => setMostrarModalStock(false)}
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

            {/* INFO DEL PRODUCTO */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                {productoEncontrado.codigo_producto}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {productoEncontrado.descripcion}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669', marginTop: '4px' }}>
                Stock actual: {productoEncontrado.stock}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* TIPO DE MOVIMIENTO */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Tipo de Movimiento
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => setStockUpdate(prev => ({...prev, tipo: 'entrada'}))}
                    style={{
                      padding: '12px',
                      backgroundColor: stockUpdate.tipo === 'entrada' ? '#22c55e' : '#f3f4f6',
                      color: stockUpdate.tipo === 'entrada' ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ➕ Entrada
                  </button>
                  <button
                    onClick={() => setStockUpdate(prev => ({...prev, tipo: 'salida'}))}
                    style={{
                      padding: '12px',
                      backgroundColor: stockUpdate.tipo === 'salida' ? '#ef4444' : '#f3f4f6',
                      color: stockUpdate.tipo === 'salida' ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    ➖ Salida
                  </button>
                </div>
              </div>

              {/* CANTIDAD */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Cantidad a modificar"
                  value={stockUpdate.cantidad || ''}
                  onChange={(e) => setStockUpdate(prev => ({...prev, cantidad: parseInt(e.target.value) || 0}))}
                  style={{
                    width: '100%',
padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             {/* MOTIVO */}
             <div>
               <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                 Motivo (Opcional)
               </label>
               <input
                 type="text"
                 placeholder="Ej: Recepción, Venta, Ajuste..."
                 value={stockUpdate.motivo}
                 onChange={(e) => setStockUpdate(prev => ({...prev, motivo: e.target.value}))}
                 style={{
                   width: '100%',
                   padding: isMobile ? '16px' : '12px',
                   border: '1px solid #d1d5db',
                   borderRadius: '6px',
                   fontSize: isMobile ? '16px' : '14px'
                 }}
               />
             </div>

             {/* PREVIEW DEL NUEVO STOCK */}
             {stockUpdate.cantidad > 0 && (
               <div style={{
                 backgroundColor: stockUpdate.tipo === 'entrada' ? '#ecfdf5' : '#fef2f2',
                 padding: '12px',
                 borderRadius: '8px',
                 border: `1px solid ${stockUpdate.tipo === 'entrada' ? '#22c55e' : '#ef4444'}`
               }}>
                 <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                   Stock resultante:
                 </div>
                 <div style={{ 
                   fontSize: '18px', 
                   fontWeight: '600', 
                   color: stockUpdate.tipo === 'entrada' ? '#166534' : '#dc2626'
                 }}>
                   {stockUpdate.tipo === 'entrada' 
                     ? productoEncontrado.stock + stockUpdate.cantidad
                     : Math.max(0, productoEncontrado.stock - stockUpdate.cantidad)
                   }
                 </div>
                 {stockUpdate.tipo === 'salida' && stockUpdate.cantidad > productoEncontrado.stock && (
                   <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                     ⚠️ La cantidad supera el stock disponible
                   </div>
                 )}
               </div>
             )}
           </div>

           <div style={{
             display: 'flex',
             gap: '12px',
             justifyContent: 'flex-end',
             marginTop: '24px'
           }}>
             <button
               onClick={() => setMostrarModalStock(false)}
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
               onClick={actualizarStock}
               disabled={loading || !stockUpdate.cantidad || stockUpdate.cantidad <= 0}
               style={{
                 padding: '12px 20px',
                 backgroundColor: loading || !stockUpdate.cantidad ? '#9ca3af' : '#f59e0b',
                 color: 'white',
                 border: 'none',
                 borderRadius: '8px',
                 fontSize: '14px',
                 cursor: loading || !stockUpdate.cantidad ? 'not-allowed' : 'pointer',
                 fontWeight: '500',
                 minHeight: '44px'
               }}
             >
               {loading ? 'Actualizando...' : 'Actualizar Stock'}
             </button>
           </div>
         </div>
       </div>
     )}

     {/* HISTORIAL DE ESCANEOS RÁPIDO */}
     {historialEscaneos.length > 0 && (
       <div style={{
         backgroundColor: 'white',
         borderRadius: '12px',
         padding: isMobile ? '16px' : '20px',
         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
       }}>
         <h3 style={{ 
           margin: '0 0 12px 0', 
           fontSize: isMobile ? '16px' : '18px', 
           fontWeight: '600', 
           color: '#1f2937' 
         }}>
           🕒 Historial de Escaneos ({historialEscaneos.length})
         </h3>
         
         <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
           {historialEscaneos.slice(0, 10).map((scan, index) => (
             <div
               key={index}
               style={{
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'space-between',
                 padding: '8px',
                 backgroundColor: scan.accion === 'encontrado' ? '#f0fdf4' :
                                 scan.accion === 'no_encontrado' ? '#fef3c7' : '#fef2f2',
                 borderRadius: '6px',
                 marginBottom: '6px',
                 fontSize: '12px'
               }}
             >
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span style={{ fontSize: '16px' }}>
                   {scan.accion === 'encontrado' ? '✅' :
                    scan.accion === 'no_encontrado' ? '⚠️' : '❌'}
                 </span>
                 <span style={{ fontFamily: 'monospace', color: '#374151' }}>
                   {scan.codigo_barras}
                 </span>
                 {scan.producto && (
                   <span style={{ color: '#6b7280' }}>
                     → {scan.producto.codigo_producto}
                   </span>
                 )}
               </div>
               <span style={{ color: '#9ca3af' }}>
                 {scan.timestamp.toLocaleTimeString()}
               </span>
             </div>
           ))}
         </div>
       </div>
     )}

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
         📱 Escáner Feraben SRL - Sistema Profesional EAN13
       </div>
       <div style={{ fontSize: '12px', opacity: 0.6 }}>
         ✅ Validación EAN13 • ✅ Alta rápida • ✅ Actualización stock • ✅ Mobile optimizado
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
         
         /* Estilos específicos para el escáner */
         #qr-reader {
           border-radius: 12px;
           overflow: hidden;
         }
         
         #qr-reader__dashboard_section {
           display: none !important; /* Ocultar controles innecesarios */
         }
         
         #qr-reader__header_message {
           font-size: 14px !important;
           color: white !important;
           background: rgba(0,0,0,0.7) !important;
           padding: 8px !important;
           border-radius: 4px !important;
           margin: 8px !important;
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
       
       /* Estilos específicos para html5-qrcode */
       #qr-reader {
         width: 100% !important;
       }
       
       #qr-reader__scan_region {
         border-radius: 8px !important;
       }
       
       #qr-reader__dashboard {
         display: none !important;
       }
       
       .qr-code-result {
         background-color: rgba(34, 197, 94, 0.9) !important;
         color: white !important;
         padding: 8px !important;
         border-radius: 4px !important;
         font-weight: 600 !important;
       }
     `}</style>
   </div>
 );
};

export default Scanner;