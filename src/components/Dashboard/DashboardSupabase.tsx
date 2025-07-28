// src/components/Dashboard/DashboardSupabase.tsx
// Dashboard que muestra datos REALES desde Supabase

import { useState, useEffect } from 'react'
import { Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

interface EstadisticasReales {
  totalProductos: number
  productosStockBajo: number
  valorTotalInventario: number
  productosActivos: number
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
          .select('stock, precio_venta, stock_minimo, activo')
        
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

        setStats({
          totalProductos,
          productosStockBajo,
          valorTotalInventario,
          productosActivos: totalProductos,
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