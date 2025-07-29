# 🏢 FERABEN SRL - ERP System Documentation

## 📋 Project Overview
**ERP completo para negocio mayorista de accesorios, bijouterie y marroquinería**
- **Estado actual**: 95% funcional, listo para producción
- **Inventario real**: 324 productos, valor $5,003,848.66 UYU
- **Tecnologías**: React + TypeScript + Tailwind + Supabase
- **Deploy**: Vercel (automático desde GitHub)

---

## 🎯 Business Model Context
- **Tipo**: Mayorista importador desde China
- **Productos**: Accesorios para pelo, bijouterie, marroquinería
- **Particularidad**: Productos de moda, rara vez se reimporta lo mismo
- **Objetivo stock crítico**: Dar de baja antes de agotarse (no restock)
- **Costos**: USD en China → UYU en Uruguay (necesita conversión)

---

## ✅ FUNCIONALIDADES IMPLEMENTADAS

### 🔥 Core Modules (100% completos)
- **📦 Inventario**: Gestión completa de productos con código de barras visible
- **📱 WhatsApp Converter**: Procesamiento perfecto de mensajes a pedidos
- **🛒 Pedidos**: Sistema completo con workflow de depósito
- **💰 Facturación**: Exportación Excel con cálculos precisos

### 📊 Dashboard Analytics (RECIÉN IMPLEMENTADO)
- **🚨 Alertas Stock Crítico**: Top 10 productos llegando al límite (para dar de baja)
- **📈 Top 10 Más Vendidos**: Productos estrella basados en pedidos reales
- **💰 Rentabilidad Bruta vs Neta**: Análisis completo de márgenes
- **📅 Tendencias por Mes**: Gráfico de barras últimos 6 meses
- **🔵 Gráficos Visuales**: Circular top 5 + distribución de productos

### 🛠️ Scanner Multi-Engine
- **Estado**: Funciona pero necesita mejoras
- **Engines**: Quagga2, html5-qrcode, BarcodeDetector nativo
- **Optimizado**: Samsung S23

---

## 💱 CONFIGURACIÓN DE COSTOS (Última implementación)

### Inputs Configurables
```
💱 Tipo de cambio USD → UYU: [41] (default)
📦 Factor costos importación: [1.35] (default)
```

### Cálculo de Rentabilidad
```
Costo China: $0.31 USD
× Tipo cambio $41 = $12.71 UYU (bruto)
× Factor 1.35 = $17.16 UYU (neto con importación)
vs Venta $50 UYU = 191% ganancia NETA
```

### Persistencia
- Guardado en `localStorage`
- Recálculo automático al cambiar valores
- Top 10 ordenado por margen NETO (más real para decisiones)

---

## 🗄️ DATABASE STRUCTURE (Supabase)

### Tablas Principales
- **`inventario`**: productos con precios USD/UYU, stock, códigos
- **`pedidos`**: órdenes con fechas, clientes, estados
- **`pedido_items`**: items específicos con cantidades y variantes

### Nombres Correctos (¡Importante!)
- ✅ `pedido_items` (NO `pedidos_items`)
- ✅ `cantidad_pedida` (NO `cantidad`)
- ✅ `codigo_producto`, `precio_costo`, `precio_venta`

---

## 🚀 DEPLOYMENT

### GitHub → Vercel
- **Repo**: `github.com/Ferabensrl/ERP-Ferabensrl`
- **Branch**: `main`
- **Deploy**: Automático en cada push
- **URL**: [Ver en Vercel]

### Últimos Commits Importantes
```
6fefd06 🚀 MEGA UPDATE: Rentabilidad REAL - Margen Bruto vs Neto
444460e 🔧 FIX: Corregir error de sintaxis en Dashboard
049ce3f 💱 Agregar configuración de tipo de cambio USD→UYU
```

---

## 📋 TODO LIST & NEXT STEPS

### 🔧 Mejoras Técnicas Pendientes
- [ ] **Scanner**: Mejorar UI y feedback visual
- [ ] **Mobile**: Optimización responsive completa
- [ ] **Performance**: Code splitting para chunks grandes

### 🚀 Funcionalidades Futuras
- [ ] **CRM Integration**: Clientes, historial, seguimiento
- [ ] **Reportes Avanzados**: Excel personalizables, filtros
- [ ] **Predicción Stock**: Basado en velocidad de venta
- [ ] **Multi-usuario**: Roles, permisos, auditoría
- [ ] **API REST**: Para integraciones externas

### 💡 Ideas de Negocio
- [ ] **Análisis ABC**: Clasificación de productos por rentabilidad
- [ ] **Alertas Inteligentes**: Notificaciones por email/WhatsApp
- [ ] **Dashboard Móvil**: App nativa o PWA
- [ ] **Integración Contable**: Conexión con software contable

---

## 🛠️ DEVELOPMENT NOTES

### Comandos Útiles
```bash
npm run dev          # Desarrollo local
npm run build        # Build para producción
npm run typecheck    # Verificar tipos
git push origin main # Deploy a Vercel
```

### Estructura de Archivos
```
src/
├── components/
│   ├── Dashboard/DashboardSupabase.tsx (💰 CON RENTABILIDAD)
│   ├── Inventario/Inventario.tsx
│   ├── Pedidos/Pedidos.tsx
│   ├── Facturacion/Facturacion.tsx
│   ├── Scanner/ScannerMultiEngine.tsx
│   └── WhatsApp/WhatsAppConverter.tsx
├── lib/
│   └── supabaseClient.ts (🔧 SERVICIOS DB)
└── App.tsx
```

---

## 🎯 CURRENT STATUS

### ✅ Production Ready
- Sistema estable funcionando en Vercel
- Todos los módulos core operativos
- Dashboard con métricas reales implementado
- Configuración de costos funcional

### 🔄 En Uso
- 324 productos reales cargados
- Sistema de pedidos activo
- Facturación con Excel exports
- Análisis de rentabilidad operativo

### 💪 Fortalezas
- Código limpio y bien estructurado
- TypeScript para type safety
- Responsive design
- Datos reales de negocio
- Métricas útiles para decisiones

---

## 📞 CONTACT & SESSION CONTINUITY

### Para próximas sesiones:
1. **Decir**: "Lee CLAUDE.md para el contexto del proyecto"
2. **Mencionar**: Qué funcionalidad quieres trabajar
3. **Recordar**: Siempre hacer backup antes de cambios grandes

### Patrones de trabajo establecidos:
- ✅ Usar TodoWrite para trackear tareas
- ✅ Hacer commits descriptivos con emojis
- ✅ Probar build local antes de push
- ✅ Ser conservador con cambios (no romper lo que funciona)

---

**🚀 READY FOR NEXT SESSION!** 
*Sistema sólido, documentado y listo para seguir creciendo.*