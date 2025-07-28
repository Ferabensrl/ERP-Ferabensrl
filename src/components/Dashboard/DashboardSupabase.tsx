// src/components/Dashboard/DashboardSupabase.tsx
// Dashboard que muestra datos REALES desde Supabase

import { useState, useEffect } from 'react'
import { Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

interface ProductoStockCritico {
  codigo_producto: string
  descripcion: string
  stock: number
  stock_minimo: number
  diferencia: number
}

interface ProductoMasVendido {
  codigo_producto: string
  descripcion: string
  total_vendido: number
  veces_vendido: number
}

interface ProductoRentable {
  codigo_producto: string
  descripcion: string
  precio_venta: number
  precio_costo: number
  margen_bruto: number
  porcentaje_ganancia: number
}

interface VentasPorMes {
  mes: string
  total_unidades: number
  total_productos_distintos: number
}

interface EstadisticasReales {
  totalProductos: number
  productosStockBajo: number
  valorTotalInventario: number
  productosActivos: number
  productosStockCritico: ProductoStockCritico[]
  productosMasVendidos: ProductoMasVendido[]
  productosRentables: ProductoRentable[]
  ventasPorMes: VentasPorMes[]
  loading: boolean
  error: string | null
}

interface DashboardSupabaseProps {
  onNavigate: (modulo: string) => void
}

const DashboardSupabase: React.FC<DashboardSupabaseProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<EstadisticasReales>({
    totalProductos: 0,
    productosStockBajo: 0,
    valorTotalInventario: 0,
    productosActivos: 0,
    productosStockCritico: [],
    productosMasVendidos: [],
    productosRentables: [],
    ventasPorMes: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        console.log('📊 Cargando estadísticas desde Supabase...')
        
        // Obtener estadísticas de productos - CORREGIDO para tu estructura
        const { data: productos, error } = await supabase
          .from('inventario')
          .select('codigo_producto, descripcion, stock, precio_venta, stock_minimo, activo')
        
        if (error) {
          console.error('❌ Error de Supabase:', error)
          throw error
        }

        console.log('✅ Productos obtenidos:', productos?.length)
        console.log('🔍 Muestra productos:', productos?.slice(0, 3))

        // Calcular estadísticas - AJUSTADO para tu estructura
        const productosActivos = productos?.filter(p => p.activo === true) || []
        const totalProductos = productosActivos.length
        
        // Manejar productos sin stock_minimo definido
        const productosStockBajo = productosActivos.filter(p => {
          const stockMin = p.stock_minimo || 0
          return p.stock <= stockMin
        }).length
        
        const valorTotalInventario = productosActivos.reduce(
          (total, p) => total + ((p.precio_venta || 0) * (p.stock || 0)), 0
        )

        // 🚨 CRÍTICO: Productos llegando al límite de stock (para dar de baja)
        const productosConStockMinimo = productosActivos.filter(p => 
          p.stock_minimo != null && p.stock_minimo > 0
        )
        
        const productosStockCritico = productosConStockMinimo
          .map(p => ({
            codigo_producto: p.codigo_producto,
            descripcion: p.descripcion,
            stock: p.stock || 0,
            stock_minimo: p.stock_minimo || 0,
            diferencia: (p.stock || 0) - (p.stock_minimo || 0)
          }))
          .filter(p => p.diferencia <= 5) // Productos a 5 unidades o menos del límite
          .sort((a, b) => a.diferencia - b.diferencia) // Los más críticos primero
          .slice(0, 10) // Top 10 más críticos

        console.log('🚨 Productos stock crítico:', productosStockCritico)

        // 📊 TOP 10 productos más vendidos
        const { data: pedidoItems, error: pedidosError } = await supabase
          .from('pedido_items')
          .select('codigo_producto, cantidad_pedida')

        if (pedidosError) {
          console.error('❌ Error obteniendo pedidos:', pedidosError)
        }

        let productosMasVendidos: ProductoMasVendido[] = []
        
        if (pedidoItems && pedidoItems.length > 0) {
          // Agrupar por código de producto y sumar cantidades
          const ventasPorProducto = pedidoItems.reduce((acc: Record<string, any>, item) => {
            const codigo = item.codigo_producto
            if (!acc[codigo]) {
              // Buscar descripción en productos ya cargados
              const producto = productos?.find(p => p.codigo_producto === codigo)
              acc[codigo] = {
                codigo_producto: codigo,
                descripcion: producto?.descripcion || 'Sin descripción',
                total_vendido: 0,
                veces_vendido: 0
              }
            }
            acc[codigo].total_vendido += item.cantidad_pedida || 0
            acc[codigo].veces_vendido += 1
            return acc
          }, {})

          // Convertir a array y ordenar por total vendido
          productosMasVendidos = Object.values(ventasPorProducto)
            .sort((a: any, b: any) => b.total_vendido - a.total_vendido)
            .slice(0, 10)
            
          console.log('📊 Top productos más vendidos:', productosMasVendidos)
        }

        // 💰 RENTABILIDAD: Productos con mejor margen bruto
        const productosConCosto = productosActivos.filter(p => 
          p.precio_costo != null && p.precio_costo > 0 && p.precio_venta > 0
        )
        
        const productosRentables = productosConCosto
          .map(p => {
            const precioVenta = p.precio_venta || 0
            const precioCosto = p.precio_costo || 0
            const margenBruto = precioVenta - precioCosto
            const porcentajeGanancia = precioCosto > 0 ? ((margenBruto / precioCosto) * 100) : 0
            
            return {
              codigo_producto: p.codigo_producto,
              descripcion: p.descripcion,
              precio_venta: precioVenta,
              precio_costo: precioCosto,
              margen_bruto: margenBruto,
              porcentaje_ganancia: porcentajeGanancia
            }
          })
          .sort((a, b) => b.porcentaje_ganancia - a.porcentaje_ganancia)
          .slice(0, 10)

        console.log('💰 Top productos rentables:', productosRentables)

        // 📅 TENDENCIAS: Ventas por mes desde pedidos
        const { data: pedidos, error: pedidosMainError } = await supabase
          .from('pedidos')
          .select('created_at')

        let ventasPorMes: VentasPorMes[] = []
        
        if (pedidos && pedidos.length > 0 && pedidoItems && pedidoItems.length > 0) {
          // Crear mapa de pedido_id a fecha
          const fechasPedidos = pedidos.reduce((acc: Record<string, string>, pedido: any) => {
            acc[pedido.id] = pedido.created_at
            return acc
          }, {})

          // Obtener pedido_id de items para hacer join manual
          const { data: itemsConPedido, error: itemsError } = await supabase
            .from('pedido_items')
            .select('pedido_id, cantidad_pedida, codigo_producto')

          if (itemsConPedido && !itemsError) {
            // Procesar ventas por mes
            const ventasPorMesMap = itemsConPedido.reduce((acc: Record<string, any>, item) => {
              const fechaPedido = fechasPedidos[item.pedido_id]
              if (fechaPedido) {
                const fecha = new Date(fechaPedido)
                const mesAno = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
                
                if (!acc[mesAno]) {
                  acc[mesAno] = { total_unidades: 0, productos_distintos: new Set() }
                }
                
                acc[mesAno].total_unidades += item.cantidad_pedida || 0
                acc[mesAno].productos_distintos.add(item.codigo_producto)
              }
              return acc
            }, {})

            ventasPorMes = Object.entries(ventasPorMesMap)
              .map(([mes, data]: [string, any]) => ({
                mes,
                total_unidades: data.total_unidades,
                total_productos_distintos: data.productos_distintos.size
              }))
              .sort((a, b) => a.mes.localeCompare(b.mes))
              .slice(-6) // Últimos 6 meses
          }
        }

        console.log('📅 Tendencias por mes:', ventasPorMes)

        setStats({
          totalProductos,
          productosStockBajo,
          valorTotalInventario,
          productosActivos: totalProductos,
          productosStockCritico,
          productosMasVendidos,
          productosRentables,
          ventasPorMes,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error)
        setStats(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }))
      }
    }

    cargarEstadisticas()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU'
    }).format(value)
  }

  if (stats.loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px'
      }}>
        <div style={{ fontSize: '48px' }}>🔄</div>
        <h2 style={{ color: '#2563eb' }}>Cargando datos desde Supabase...</h2>
      </div>
    )
  }

  if (stats.error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px' }}>❌</div>
        <h2 style={{ color: '#dc2626' }}>Error de conexión</h2>
        <p style={{ color: '#6b7280', textAlign: 'center' }}>
          {stats.error}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          📊 Dashboard Feraben SRL
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: 0
        }}>
          Sistema de Inventario v3.0 - Conectado a Supabase ✅
        </p>
      </div>

      {/* Estadísticas principales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Total Productos */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Package size={32} style={{ color: '#3b82f6' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              Total Productos
            </h3>
          </div>
          <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>
            {stats.totalProductos.toLocaleString()}
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>
            Productos activos en inventario
          </p>
        </div>

        {/* Stock Bajo */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: stats.productosStockBajo > 0 ? '2px solid #f59e0b' : '2px solid #10b981'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={32} style={{ color: stats.productosStockBajo > 0 ? '#f59e0b' : '#10b981' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              Stock Bajo
            </h3>
          </div>
          <p style={{ 
            fontSize: '36px', 
            fontWeight: 'bold', 
            color: stats.productosStockBajo > 0 ? '#f59e0b' : '#10b981', 
            margin: 0 
          }}>
            {stats.productosStockBajo}
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>
            Productos bajo stock mínimo
          </p>
        </div>

        {/* Valor Total */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #10b981'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TrendingUp size={32} style={{ color: '#10b981' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              Valor Total
            </h3>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>
            {formatCurrency(stats.valorTotalInventario)}
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>
            Valor total del inventario
          </p>
        </div>
      </div>

      {/* 🚨 ALERTA CRÍTICA: Productos llegando al límite */}
      {stats.productosStockCritico.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #fca5a5',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#dc2626',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🚨 PRODUCTOS CRÍTICOS - Dar de baja a la venta
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '12px'
          }}>
            {stats.productosStockCritico.map((producto, index) => (
              <div key={producto.codigo_producto} style={{
                backgroundColor: 'white',
                padding: '16px',
                borderRadius: '8px',
                border: producto.diferencia <= 0 ? '2px solid #dc2626' : '1px solid #fca5a5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#1f2937', 
                    margin: '0 0 4px 0' 
                  }}>
                    {producto.codigo_producto}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    margin: 0,
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {producto.descripcion}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    color: producto.diferencia <= 0 ? '#dc2626' : '#f59e0b',
                    margin: '0 0 4px 0' 
                  }}>
                    {producto.stock} uds
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    margin: 0 
                  }}>
                    Mín: {producto.stock_minimo}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fcd34d'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#92400e', 
              margin: 0,
              textAlign: 'center'
            }}>
              💡 <strong>Tip:</strong> Estos productos están cerca del stock mínimo. Considerá darlos de baja antes de quedarte sin mercadería.
            </p>
          </div>
        </div>
      )}

      {/* 📊 TOP 10 productos más vendidos */}
      {stats.productosMasVendidos.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #10b981',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#10b981',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 TOP 10 - Productos Más Vendidos
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '12px'
          }}>
            {stats.productosMasVendidos.map((producto, index) => (
              <div key={producto.codigo_producto} style={{
                backgroundColor: index < 3 ? '#f0fdf4' : '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                border: index < 3 ? '2px solid #10b981' : '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative'
              }}>
                {index < 3 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                )}
                
                <div style={{ maxWidth: '200px' }}>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#1f2937', 
                    margin: '0 0 4px 0' 
                  }}>
                    {producto.codigo_producto}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {producto.descripcion}
                  </p>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <p style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    color: '#10b981',
                    margin: '0 0 4px 0' 
                  }}>
                    {producto.total_vendido} uds
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    margin: 0 
                  }}>
                    {producto.veces_vendido} pedidos
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#ecfdf5',
            borderRadius: '8px',
            border: '1px solid #a7f3d0'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#065f46', 
              margin: 0,
              textAlign: 'center'
            }}>
              🎯 <strong>Insight:</strong> Estos son tus productos estrella. Considerá tener stock suficiente de estos códigos.
            </p>
          </div>
        </div>
      )}

      {/* 💰 RENTABILIDAD: Top productos más rentables */}
      {stats.productosRentables.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #8b5cf6',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#8b5cf6',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💰 TOP 10 - Productos Más Rentables (Margen Bruto)
          </h3>
          
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fcd34d'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#92400e', 
              margin: 0,
              textAlign: 'center'
            }}>
              ⚠️ <strong>Nota:</strong> Cálculo base sin costos de importación. Ideal para priorizar productos al importar desde China.
            </p>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '12px'
          }}>
            {stats.productosRentables.map((producto, index) => (
              <div key={producto.codigo_producto} style={{
                backgroundColor: index < 3 ? '#f3e8ff' : '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                border: index < 3 ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                position: 'relative'
              }}>
                {index < 3 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                )}
                
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#1f2937', 
                    margin: '0 0 4px 0' 
                  }}>
                    {producto.codigo_producto}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#6b7280', 
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {producto.descripcion}
                  </p>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Costo: </span>
                    <span style={{ fontWeight: 'bold' }}>${producto.precio_costo.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Venta: </span>
                    <span style={{ fontWeight: 'bold' }}>${producto.precio_venta.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Margen: </span>
                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>${producto.margen_bruto.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Ganancia: </span>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: '#8b5cf6',
                      fontSize: '14px'
                    }}>
                      {producto.porcentaje_ganancia.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📅 TENDENCIAS: Ventas por mes */}
      {stats.ventasPorMes.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #f59e0b',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#f59e0b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📅 Tendencias de Ventas - Últimos 6 Meses
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            {stats.ventasPorMes.map((venta, index) => {
              const [ano, mes] = venta.mes.split('-')
              const nombreMes = new Date(parseInt(ano), parseInt(mes) - 1).toLocaleDateString('es-ES', { month: 'short' })
              const maxUnidades = Math.max(...stats.ventasPorMes.map(v => v.total_unidades))
              const alturaGrafico = (venta.total_unidades / maxUnidades) * 100
              
              return (
                <div key={venta.mes} style={{
                  textAlign: 'center'
                }}>
                  <div style={{
                    height: '120px',
                    display: 'flex',
                    alignItems: 'end',
                    justifyContent: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: '60px',
                      height: `${alturaGrafico}%`,
                      backgroundColor: '#f59e0b',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '10px',
                      display: 'flex',
                      alignItems: 'start',
                      justifyContent: 'center',
                      paddingTop: '4px',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {venta.total_unidades}
                    </div>
                  </div>
                  <p style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: '#1f2937', 
                    margin: '0 0 4px 0',
                    textTransform: 'capitalize'
                  }}>
                    {nombreMes} {ano}
                  </p>
                  <p style={{ 
                    fontSize: '10px', 
                    color: '#6b7280', 
                    margin: 0 
                  }}>
                    {venta.total_productos_distintos} productos
                  </p>
                </div>
              )
            })}
          </div>
          
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fcd34d'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#92400e', 
              margin: 0,
              textAlign: 'center'
            }}>
              📈 <strong>Insight:</strong> Seguí estas tendencias para planificar tus próximas importaciones desde China.
            </p>
          </div>
        </div>
      )}

      {/* 📊 GRÁFICOS: Distribución de productos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Gráfico circular - Top 5 más vendidos */}
        {stats.productosMasVendidos.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: '2px solid #06b6d4'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#06b6d4',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              🔵 Top 5 Más Vendidos
            </h4>
            
            <div style={{ position: 'relative', textAlign: 'center' }}>
              {/* Simulación de gráfico circular con CSS */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `conic-gradient(
                  #06b6d4 0% ${(stats.productosMasVendidos[0]?.total_vendido / stats.productosMasVendidos.slice(0,5).reduce((sum, p) => sum + p.total_vendido, 0)) * 100}%,
                  #10b981 ${(stats.productosMasVendidos[0]?.total_vendido / stats.productosMasVendidos.slice(0,5).reduce((sum, p) => sum + p.total_vendido, 0)) * 100}% ${((stats.productosMasVendidos[0]?.total_vendido + stats.productosMasVendidos[1]?.total_vendido) / stats.productosMasVendidos.slice(0,5).reduce((sum, p) => sum + p.total_vendido, 0)) * 100}%,
                  #f59e0b ${((stats.productosMasVendidos[0]?.total_vendido + stats.productosMasVendidos[1]?.total_vendido) / stats.productosMasVendidos.slice(0,5).reduce((sum, p) => sum + p.total_vendido, 0)) * 100}% 80%,
                  #8b5cf6 80% 90%,
                  #ef4444 90% 100%
                )`,
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                TOP 5
              </div>
              
              <div style={{ fontSize: '12px', textAlign: 'left' }}>
                {stats.productosMasVendidos.slice(0, 5).map((producto, index) => {
                  const colores = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
                  return (
                    <div key={producto.codigo_producto} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: colores[index],
                        borderRadius: '2px',
                        marginRight: '8px'
                      }}></div>
                      <span style={{ fontSize: '11px' }}>
                        {producto.codigo_producto} ({producto.total_vendido})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Gráfico de barras - Productos por categoría */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '2px solid #22c55e'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#22c55e',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            📊 Estado del Inventario
          </h4>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div>
                <div style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    width: `${stats.totalProductos > 0 ? ((stats.totalProductos - stats.productosStockBajo) / stats.totalProductos) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: '#22c55e',
                    borderRadius: '10px'
                  }}></div>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#22c55e', fontWeight: 'bold' }}>
                  Stock Normal: {stats.totalProductos - stats.productosStockBajo}
                </p>
              </div>
              
              <div>
                <div style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    width: `${stats.totalProductos > 0 ? (stats.productosStockBajo / stats.totalProductos) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: '#f59e0b',
                    borderRadius: '10px'
                  }}></div>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#f59e0b', fontWeight: 'bold' }}>
                  Stock Bajo: {stats.productosStockBajo}
                </p>
              </div>
              
              <div>
                <div style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    width: `${stats.totalProductos > 0 ? (stats.productosStockCritico.length / stats.totalProductos) * 100 : 0}%`,
                    height: '100%',
                    backgroundColor: '#ef4444',
                    borderRadius: '10px'
                  }}></div>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: '#ef4444', fontWeight: 'bold' }}>
                  Críticos: {stats.productosStockCritico.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '20px'
        }}>
          🚀 Accesos Rápidos
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <button
            onClick={() => onNavigate('inventario')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e0f2fe'
              e.currentTarget.style.borderColor = '#3b82f6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <Package size={24} style={{ color: '#3b82f6' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                Ver Inventario
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Gestionar productos y stock
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('whatsapp')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0fdf4'
              e.currentTarget.style.borderColor = '#10b981'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <ShoppingCart size={24} style={{ color: '#10b981' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                Nuevo Pedido
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Convertir WhatsApp a pedido
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Información de conexión */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#ecfdf5',
        borderRadius: '8px',
        border: '1px solid #a7f3d0',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '14px', color: '#065f46', margin: 0 }}>
          ✅ <strong>Conectado a Supabase</strong> - Datos en tiempo real
        </p>
      </div>
    </div>
  )
}

export default DashboardSupabase