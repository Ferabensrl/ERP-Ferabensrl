import React from 'react';
import { Package, Clock, AlertCircle, CheckCircle, Users, FileText } from 'lucide-react';

const Dashboard: React.FC = () => (
  <div>
    {/* Welcome Section */}
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '30px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Dashboard</h2>
      <p style={{ color: '#6b7280' }}>Bienvenido al sistema de gestión de Feraben SRL</p>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>
        <Clock size={16} style={{ marginRight: '8px' }} />
        <span>martes, 22 de julio de 2025</span>
      </div>
    </div>

    {/* Stats Cards */}
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
      gap: '24px', 
      marginBottom: '32px' 
    }}>
      
      {/* Pedidos Pendientes */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '24px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Pedidos Pendientes</p>
            <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: '8px 0' }}>3</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Por preparar</p>
          </div>
          <div style={{ 
            padding: '12px', 
            borderRadius: '12px', 
            backgroundColor: '#fed7aa'
          }}>
            <Clock size={24} style={{ color: '#f97316' }} />
          </div>
        </div>
      </div>

      {/* En Preparación */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '24px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>En Preparación</p>
            <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: '8px 0' }}>2</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Activos ahora</p>
          </div>
          <div style={{ 
            padding: '12px', 
            borderRadius: '12px', 
            backgroundColor: '#dbeafe'
          }}>
            <Package size={24} style={{ color: '#3b82f6' }} />
          </div>
        </div>
      </div>

      {/* Stock Bajo */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '24px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Stock Bajo</p>
            <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: '8px 0' }}>5</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{'< 10 unidades'}</p>
          </div>
          <div style={{ 
            padding: '12px', 
            borderRadius: '12px', 
            backgroundColor: '#fee2e2'
          }}>
            <AlertCircle size={24} style={{ color: '#ef4444' }} />
          </div>
        </div>
      </div>

      {/* Clientes Activos */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        padding: '24px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Clientes Activos</p>
            <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: '8px 0' }}>12</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Este mes</p>
          </div>
          <div style={{ 
            padding: '12px', 
            borderRadius: '12px', 
            backgroundColor: '#dcfce7'
          }}>
            <Users size={24} style={{ color: '#22c55e' }} />
          </div>
        </div>
      </div>

    </div>

    {/* Quick Actions */}
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '12px', 
      padding: '24px', 
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      marginBottom: '32px'
    }}>
      <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Acciones Rápidas</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        
        {/* Nuevo Pedido WhatsApp */}
        <button style={{ 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '16px', 
          textAlign: 'left',
          cursor: 'pointer'
        }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '8px', 
            borderRadius: '8px', 
            backgroundColor: '#dbeafe', 
            marginBottom: '12px' 
          }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
          </div>
          <h4 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Nuevo Pedido WhatsApp</h4>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Convertir mensaje a pedido</p>
        </button>

        {/* Ver Inventario */}
        <button style={{ 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '16px', 
          textAlign: 'left',
          cursor: 'pointer'
        }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '8px', 
            borderRadius: '8px', 
            backgroundColor: '#f3e8ff', 
            marginBottom: '12px' 
          }}>
            <Package size={20} style={{ color: '#9333ea' }} />
          </div>
          <h4 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Ver Inventario</h4>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Gestionar productos</p>
        </button>

        {/* Preparar Pedidos */}
        <button style={{ 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '16px', 
          textAlign: 'left',
          cursor: 'pointer'
        }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '8px', 
            borderRadius: '8px', 
            backgroundColor: '#dcfce7', 
            marginBottom: '12px' 
          }}>
            <CheckCircle size={20} style={{ color: '#16a34a' }} />
          </div>
          <h4 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Preparar Pedidos</h4>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Ir al depósito</p>
        </button>

      </div>
    </div>

    {/* Recent Activity */}
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '12px', 
      padding: '24px', 
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>Actividad Reciente</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Actividad 1 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          paddingBottom: '12px', 
          borderBottom: '1px solid #f3f4f6' 
        }}>
          <div style={{ 
            padding: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#fed7aa', 
            marginRight: '12px' 
          }}>
            <Clock size={16} style={{ color: '#9a3412' }} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', margin: 0 }}>Nuevo pedido de Supermercado Central</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Hace 2 horas</p>
          </div>
        </div>

        {/* Actividad 2 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          paddingBottom: '12px', 
          borderBottom: '1px solid #f3f4f6' 
        }}>
          <div style={{ 
            padding: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#fee2e2', 
            marginRight: '12px' 
          }}>
            <AlertCircle size={16} style={{ color: '#991b1b' }} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', margin: 0 }}>Stock bajo: Cinto de dama (LB010)</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Hace 4 horas</p>
          </div>
        </div>

        {/* Actividad 3 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            padding: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#dcfce7', 
            marginRight: '12px' 
          }}>
            <CheckCircle size={16} style={{ color: '#166534' }} />
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', margin: 0 }}>Pedido completado: Farmacia Norte</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Ayer</p>
          </div>
        </div>

      </div>
    </div>
  </div>
);

export default Dashboard;