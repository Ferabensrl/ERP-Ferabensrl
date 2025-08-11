# 🏢 FERABEN SRL - ECOSISTEMA EMPRESARIAL COMPLETO

## 📋 OVERVIEW GENERAL
**4 aplicaciones integradas para mayorista de accesorios/bijouterie**

### 🔗 **APLICACIONES OPERATIVAS**
1. **📦 ERP Feraben** - Inventario/productos (Vercel - 324 productos)
2. **👥 CRM Feraben v2** - Clientes/ventas (Local - uso diario)  
3. **🛍️ Catálogo Mare B2B** - PWA mayorista (684 productos)
4. **🌐 Website MARÉ** - **https://mareuy.com** (institucional, SIN precios)

### 🎯 **ESTADO ACTUAL**
- **Tecnologías**: React + TypeScript + Tailwind + Supabase + PWA
- **Producción**: ERP (Vercel) + Website (mareuy.com) + Manager Central
- **En desarrollo**: CRM deploy pendiente
- **Business Model**: Mayorista China→Uruguay, stock crítico (dar de baja vs restock)

---

## ✅ FUNCIONALIDADES CORE

### 📦 **ERP FERABEN** (Vercel - Productivo)
- **Módulos**: Inventario + WhatsApp Converter + Pedidos + Facturación
- **Dashboard**: Stock crítico, Top vendidos, Rentabilidad bruta/neta, Tendencias
- **Scanner**: Multi-engine (Quagga2, html5-qrcode) - Samsung S23 optimizado

### 👥 **CRM FERABEN v2** (Local - Operativo diario)
- **Core**: Autenticación roles + Clientes + Movimientos + Estados cuenta
- **Avanzado**: Cheques + Comisiones + Dashboard por rol (Admin/Vendedor)
- **Analytics**: Métricas empresariales + comparativo anual

### 🛍️ **CATÁLOGO MARE B2B** (PWA - 684 productos)
- **PWA**: Instalable + Offline + Manager HTML + Login simplificado
- **B2B**: Carrito mayorista + WhatsApp + Precios + 18 categorías
- **Checkout**: Solo WhatsApp visible (Email/PDF ocultos para simplificar)

### 🌐 **WEBSITE MARÉ** (https://mareuy.com - Producción)
- **Institucional**: 684 productos SIN precios + Contacto oficial
- **Deploy**: GitHub→Vercel automático + Manager Central integrado

---

## 🛠️ **MARE MANAGER CENTRAL** (Puerto 3001)
**Control unificado del ecosistema desde HTML Manager con diseño corporativo MARÉ**

### 🚀 **7 FUNCIONES AUTOMATIZADAS:**
1. **⚡ Proceso Completo** - Catálogo B2B: Excel→JSON→Deploy
2. **📊 Solo Productos** - Actualiza JSON productos  
3. **🖼️ Solo Imágenes** - Sube assets nuevos
4. **🗑️ Limpiar Huérfanas** - Optimiza catálogo B2B
5. **📢 Mensaje Promocional** - Actualiza portada
6. **🌐 Actualizar Website** - Sincroniza B2B → mareuy.com
7. **🧹 Limpiar Website** - Optimiza repositorio website

### 🔄 **FLUJO UNIFICADO:**
```
📊 Excel actualizado → ⚡ Proceso Completo (B2B) → 🌐 Actualizar Website → 🚀 Ambas plataformas online
```

---

## 💱 **CONFIGURACIÓN COSTOS**
**ERP**: USD→UYU (default: $41) + Factor importación (1.35) + localStorage + recálculo automático

---

## 🗄️ **SUPABASE DATABASE** (Compartida ERP+CRM)

### 📊 **TABLAS PRINCIPALES**
- **ERP**: `inventario` + `pedidos` + `pedido_items` 
- **CRM**: `clientes` + `movimientos` + `usuarios` + `cheques` + `comisiones`
- **Compartida**: `inventario` (ERP gestión, CRM referencias)

### ⚠️ **NOMBRES CORRECTOS**
- ✅ `pedido_items` (NO pedidos_items) + `cantidad_pedida` + `codigo_producto`
- ✅ `movimientos.tipo_movimiento`: 'Venta'|'Pago'|'Nota de Crédito'|'Ajuste'|'Devolución'

---

## 🚀 **UBICACIONES & DEPLOY**

### 📂 **PATHS PRINCIPALES**
- **📦 ERP**: `C:\Users\Usuario\ERP-ferabensrl-claude\` (→ Vercel GitHub auto)
- **👥 CRM**: `C:\Users\Usuario\feraben-crm-v2-test\` (Local, deploy pendiente)
- **🛍️ Catálogo B2B**: `C:\Users\Usuario\mare-catalog-v2\` (Manager puerto 3001)
- **🌐 Website**: `C:\Users\Usuario\mare-website\` (→ https://mareuy.com)

---

## 📋 **PRÓXIMOS PASOS**
- [ ] **CRM Deploy** a Vercel 
- [ ] **Integración visual** ERP↔CRM
- [ ] **Dashboard unificado** ejecutivo
- [ ] **Scanner UI** mejorado
- [ ] **Analytics** mareuy.com

---

## 🛠️ **DESARROLLO**

### **Comandos clave:** `npm run dev` + `npm run build` + `git push origin main`

### **Estructuras principales:**
- **ERP**: Dashboard+Inventario+Pedidos+Facturación+Scanner+WhatsApp
- **CRM**: Dashboard por rol+Clientes+Movimientos+Cheques+Comisiones+Auth

---

## 🎯 **ESTADO ACTUAL**
- **✅ Productivo**: ERP (Vercel) + Website MARÉ (mareuy.com) + Manager Central
- **✅ Operativo**: CRM v2 (local) + Catálogo B2B (PWA 684 productos)
- **🔄 En uso diario**: Todas las apps con datos reales operativos
- **💪 Fortalezas**: TypeScript + PWA + Supabase + Deploy automático

---

## 📞 **INICIO RÁPIDO DE SESIÓN**

### 🔄 **Para retomar:**
1. **Comando**: "Lee CLAUDE.md para contexto del ecosistema MARÉ"
2. **Estado**: Website en https://mareuy.com + Manager Central funcionando  

### 🛠️ **Comandos de desarrollo:**
```bash
# Manager Central: cd C:\Users\Usuario\mare-catalog-v2 && npm start (puerto 3001)
# Website local: cd C:\Users\Usuario\mare-website && npm run dev  
# ERP: cd C:\Users\Usuario\ERP-ferabensrl-claude && npm run dev
# CRM: cd C:\Users\Usuario\feraben-crm-v2-test && npm start
```

### 🌟 **URLs operativas:**
- **🌐 Website**: https://mareuy.com (684 productos sin precios)
- **🛍️ Catálogo B2B**: catalogo.mareuy.com (684 productos con precios)
- **🛠️ Manager**: localhost:3001 (7 funciones automatizadas)

---

## 📋 **PATRONES DE TRABAJO**
- ✅ **TodoWrite** para tareas complejas
- ✅ **Commits descriptivos** con emojis  
- ✅ **Build local** antes de deploy
- ✅ **Conservador** (no romper lo funcional)
- ✅ **Negocio**: Mayorista China→Uruguay, dar de baja vs restock

---

## 💰 **MÓDULO GASTOS - CRM v2** (Próxima implementación)

### 🎯 **OBJETIVO**
**Separar gastos empresa vs personales de Fernando (Solo Admin)**

### 📊 **DATOS FUENTE**
- **CSV**: `feraben-crm-v2-test/Control_Gastos_2025.csv`
- **Categorías**: 27 identificadas (Empresa: Kangoo, Sueldos, BPS | Personal: UTE, Supermercado, Colegio)

### 🏗️ **ARQUITECTURA**
- **DB**: Tabla `gastos` (fecha, categoría, monto, tipo, descripción)
- **Componentes**: GastosView + DashboardGastos + FormularioGasto + ListaGastos
- **Permisos**: Solo `currentUser.rol === 'admin'`

### 📋 **ROADMAP**
1. **Fase 1**: Crear tabla Supabase + funciones CRUD
2. **Fase 2**: Componentes core + navegación App.tsx
3. **Fase 3**: Dashboard métricas Empresa vs Personal
4. **Fase 4**: Gestión avanzada + filtros
5. **Fase 5**: Importación CSV + reportes Excel

### 🔄 **Para continuar**: "Lee CLAUDE.md sección MÓDULO GASTOS - continúa implementación"

---

---

## 🎯 **CONFIGURACIÓN CHECKOUT CATÁLOGO B2B**

### 📱 **BOTONES DE ENVÍO - ESTADO ACTUAL**
- **✅ VISIBLE**: "Enviar por WhatsApp" (único botón activo)
- **❌ OCULTOS**: "Enviar por Email", "Descargar PDF", "Enviar PDF por WhatsApp"

### 🔧 **REACTIVAR BOTONES OCULTOS** (`mare-catalog-v2/src/App.tsx`)
**Ubicación**: CartModal líneas ~1010-1035

Para **reactivar** cualquier botón oculto, eliminar esta línea:
```tsx
style={{ display: 'none' }}
```

**Botones disponibles para reactivar:**
1. **Email** (línea ~1013): `handleEmailSend` - Abre cliente email
2. **PDF** (línea ~1022): `handlePdfDownload` - Descarga directa
3. **WhatsApp PDF** (línea ~1031): `handleWhatsAppPdf` - Comparte PDF via WhatsApp

### 📝 **COMMIT REFERENCIA**
- **Hash**: `ec1b1ad` - "🎯 SIMPLIFICAR: Solo WhatsApp en checkout"
- **Motivo**: Simplificar UX, evitar confusión en clientes mayoristas

---

**🎉 ECOSISTEMA COMPLETO: 4 apps integradas en producción**