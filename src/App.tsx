import { useState } from 'react'
import { Package, ShoppingCart, MessageSquare, Scan, BarChart3, FileText, Target, Inbox } from 'lucide-react'

// Importes de componentes
import Dashboard from './components/Dashboard'
import Pedidos from './components/Pedidos/Pedidos'
import WhatsAppConverter from './components/WhatsApp/WhatsAppConverter'
import Inventario from './components/Inventario/Inventario'
import ScannerMultiEngine from './components/Scanner/ScannerMultiEngine'
import Facturacion from './components/Facturacion/Facturacion'
import DashboardSupabase from './components/Dashboard/DashboardSupabase'
import ControlEjecutivo from './components/ControlEjecutivo/ControlEjecutivo'
// ✨ NUEVO COMPONENTE - Integración Catálogo → ERP
import PedidosRecibidos from './components/PedidosRecibidos/PedidosRecibidos'

// TIPOS ACTUALIZADOS para integración completa
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
  comentarios?: string;
  comentarioFinal?: string;
  total?: number;
}

function App() {
  // Estado para controlar qué módulo está activo
  const [activeModule, setActiveModule] = useState('dashboard')
  
  // ESTADO AMPLIADO para manejar pedidos WhatsApp Y completados
  const [pedidosWhatsApp, setPedidosWhatsApp] = useState<Pedido[]>([])
  const [pedidosCompletados, setPedidosCompletados] = useState<Pedido[]>([])

  // Función para agregar pedidos desde WhatsApp (MANTIENE FUNCIONALIDAD ACTUAL)
  const agregarPedidoDesdeWhatsApp = (nuevoPedido: Pedido) => {
    setPedidosWhatsApp(pedidos => [...pedidos, nuevoPedido])
    // Cambiar automáticamente al módulo de pedidos para ver el resultado
    setActiveModule('pedidos')
  }

 const completarPedido = (pedidoCompletado: Pedido) => {
  const pedidoParaFacturar = {
    ...pedidoCompletado,
    estado: 'completado' as const,
    fechaCompletado: new Date().toISOString().split('T')[0]
  }
  
  setPedidosCompletados(completados => [...completados, pedidoParaFacturar])
  
  if (pedidoCompletado.numero.includes('WA')) {
    setPedidosWhatsApp(pedidos => 
      pedidos.map(p => 
        p.id === pedidoCompletado.id 
          ? { ...p, estado: 'completado' as const }
          : p
      )
    )
  }
  
  // ✅ CORRECCIÓN: Ir al dashboard automáticamente
  setActiveModule('dashboard')
}
  // Función para renderizar el contenido según el módulo activo (ACTUALIZADA)
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardSupabase onNavigate={setActiveModule} />
      case 'pedidos':
        return (
          <Pedidos
            pedidosWhatsApp={pedidosWhatsApp}
            onCompletarPedido={completarPedido}
            onVolverDashboard={() => setActiveModule('dashboard')}
          />
        )
      // ✨ NUEVO: Pedidos Recibidos del Catálogo
      case 'pedidos-recibidos':
        return <PedidosRecibidos onVolverDashboard={() => setActiveModule('dashboard')} />
      case 'whatsapp':
        return <WhatsAppConverter />
      case 'inventario':
        return <Inventario />
      case 'scanner':
        return <ScannerMultiEngine />
      case 'facturacion':
        return (
          <Facturacion
            pedidosCompletados={pedidosCompletados}
            pedidosWhatsApp={pedidosWhatsApp}
          />
        )
      case 'control-ejecutivo':
        return <ControlEjecutivo />
      default:
        return <Dashboard />
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#2563eb', 
        color: 'white', 
        padding: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Package size={32} style={{ color: '#bfdbfe' }} />
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Feraben SRL</h1>
              <p style={{ color: '#bfdbfe', fontSize: '14px', margin: 0 }}>Sistema de Inventario y Facturación</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px' }}>Fernando</span>
            <span style={{ 
              fontSize: '12px', 
              backgroundColor: '#3b82f6', 
              padding: '4px 12px', 
              borderRadius: '9999px' 
            }}>Admin</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', overflowX: 'auto' }}>
          
          <NavButton 
            icon={<BarChart3 size={20} />} 
            text="Dashboard" 
            active={activeModule === 'dashboard'} 
            onClick={() => setActiveModule('dashboard')} 
          />

          <NavButton 
            icon={<Target size={20} />} 
            text="Control Ejecutivo" 
            active={activeModule === 'control-ejecutivo'} 
            onClick={() => setActiveModule('control-ejecutivo')} 
          />
          
          <NavButton
            icon={<ShoppingCart size={20} />}
            text="Pedidos"
            active={activeModule === 'pedidos'}
            onClick={() => setActiveModule('pedidos')}
            badge={pedidosWhatsApp.filter(p => p.estado !== 'completado').length > 0 ?
              pedidosWhatsApp.filter(p => p.estado !== 'completado').length.toString() : undefined}
          />

          {/* ✨ NUEVO: Pedidos Recibidos del Catálogo */}
          <NavButton
            icon={<Inbox size={20} />}
            text="Pedidos Recibidos"
            active={activeModule === 'pedidos-recibidos'}
            onClick={() => setActiveModule('pedidos-recibidos')}
          />

          <NavButton
            icon={<MessageSquare size={20} />}
            text="WhatsApp"
            active={activeModule === 'whatsapp'}
            onClick={() => setActiveModule('whatsapp')}
          />
          
          <NavButton 
            icon={<Package size={20} />} 
            text="Inventario" 
            active={activeModule === 'inventario'} 
            onClick={() => setActiveModule('inventario')} 
          />
          
          <NavButton 
            icon={<Scan size={20} />} 
            text="Escáner" 
            active={activeModule === 'scanner'} 
            onClick={() => setActiveModule('scanner')} 
          />

          {/* FACTURACIÓN con badge de pedidos listos */}
          <NavButton 
            icon={<FileText size={20} />} 
            text="Facturación" 
            active={activeModule === 'facturacion'} 
            onClick={() => setActiveModule('facturacion')}
            badge={pedidosCompletados.length > 0 ? pedidosCompletados.length.toString() : undefined}
          />
          
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {renderModule()}
      </main>
    </div>
  )
}

// Tipado correcto para NavButton (SIN CAMBIOS)
interface NavButtonProps {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}

// Componente para los botones de navegación (SIN CAMBIOS)
const NavButton: React.FC<NavButtonProps> = ({ icon, text, active, onClick, badge }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 20px',
      border: 'none',
      backgroundColor: 'transparent',
      borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
      color: active ? '#2563eb' : '#6b7280',
      cursor: 'pointer',
      minWidth: '100px',
      position: 'relative',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        const target = e.target as HTMLElement;
        target.style.backgroundColor = '#f9fafb';
        target.style.color = '#374151';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        const target = e.target as HTMLElement;
        target.style.backgroundColor = 'transparent';
        target.style.color = '#6b7280';
      }
    }}
  >
    <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', position: 'relative' }}>
      {icon}
      {badge && (
        <span style={{
          position: 'absolute',
          top: '-8px',
          right: '-12px',
          backgroundColor: '#ef4444',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '9999px',
          minWidth: '16px',
          textAlign: 'center'
        }}>
          {badge}
        </span>
      )}
    </div>
    <span style={{ fontSize: '12px', fontWeight: active ? '600' : '500' }}>{text}</span>
  </button>
)

export default App