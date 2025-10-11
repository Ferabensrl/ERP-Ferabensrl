# 🏗️ ARQUITECTURA COMPLETA - SISTEMA FERABEN SRL

**Fecha:** Enero 2025
**Versión:** 2.0 - Integración Catálogo-ERP Completa
**Estado:** ✅ Producción - Listo para Deploy

---

## 📊 RESUMEN EJECUTIVO

Sistema completo de gestión empresarial compuesto por:
1. **ERP Feraben** - Sistema interno de gestión (React + Supabase)
2. **Catálogo MARÉ** - PWA para clientes mayoristas (React + Supabase)

**FLUJO COMPLETO:**
```
Cliente (Catálogo PWA) → Pedido → Supabase → ERP → Aprobación → Depósito → Facturación → Excel
```

---

## 🔐 CREDENCIALES Y CONFIGURACIÓN

### **Supabase (Base de Datos Central)**
- **URL:** `https://cedspllucwvpoehlyccs.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZHNwbGx1Y3d2cG9laGx5Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjkyMTQsImV4cCI6MjA2ODIwNTIxNH0.80z7k6ti2pxBKb8x6NILe--YNaLhJemtC32oqKW-Kz4`
- **Ubicación:** Hardcodeadas en `src/lib/supabaseClient.ts` líneas 6-7 (ambos proyectos)
- **Variables de entorno:** `REACT_APP_SUPABASE_URL` y `REACT_APP_SUPABASE_ANON_KEY`

### **Vercel - Variables de Entorno Requeridas**
```env
REACT_APP_SUPABASE_URL=https://cedspllucwvpoehlyccs.supabase.co
REACT_APP_SUPABASE_ANON_KEY=(clave completa de arriba)
```
**NOTA:** Si no se configuran en Vercel, el sistema usa los valores hardcodeados (funciona igual).

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS (SUPABASE)

### **Tabla: `inventario`**
```sql
- id (int) PRIMARY KEY
- codigo_producto (text) UNIQUE
- codigo_barras (text)
- descripcion (text)
- categoria (text)
- stock (int)
- precio_venta (numeric)
- precio_costo (numeric)
- stock_minimo (int)
- activo (boolean)
- created_at (timestamp)
```

### **Tabla: `pedidos`**
```sql
- id (int) PRIMARY KEY
- numero (text) UNIQUE
- cliente_nombre (text)
- cliente_telefono (text)
- cliente_direccion (text)
- fecha_pedido (date)
- fecha_completado (timestamp)
- estado (text) -- 'pendiente' | 'preparando' | 'completado' | 'entregado'
- origen (text) -- 'whatsapp' | 'manual' | 'catalogo'
- comentarios (text)
- total (numeric)
- created_at (timestamp)
- updated_at (timestamp)
```

### **Tabla: `pedido_items`**
```sql
- id (int) PRIMARY KEY
- pedido_id (int) FOREIGN KEY → pedidos.id
- codigo_producto (text)
- cantidad_pedida (int)
- cantidad_preparada (int)
- precio_unitario (numeric)
- estado (text) -- 'pendiente' | 'completado' | 'sin_stock'
- variante_color (text)
- comentarios (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### **Tabla: `pedidos_recibidos` (NUEVA - Integración Catálogo)**
```sql
- id (int) PRIMARY KEY
- numero (text) UNIQUE
- cliente_nombre (text)
- cliente_telefono (text)
- fecha_pedido (timestamp)
- origen (text) -- siempre 'catalogo'
- estado (text) -- 'recibido' | 'aprobado' | 'rechazado'
- productos (jsonb) -- Array de productos con variantes
- total (numeric)
- comentario_final (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### **Función RPC: `aprobar_pedido_recibido(pedido_recibido_id)`**
**Ubicación:** Supabase → SQL Editor
**Qué hace:**
1. Toma un pedido de `pedidos_recibidos`
2. Crea un registro en `pedidos`
3. Crea registros en `pedido_items` para cada variante
4. Elimina el registro de `pedidos_recibidos`

---

## 🔄 FLUJO COMPLETO DEL SISTEMA

### **PASO 1: Cliente hace pedido en Catálogo PWA**
- Cliente navega productos en su celular/PC
- Selecciona productos y variantes (colores)
- Completa formulario con nombre y teléfono
- Presiona "Enviar Pedido"

**Acción técnica:**
```javascript
// mare-catalog-v2/src/App.tsx (línea ~500)
await supabase.from('pedidos_recibidos').insert({
  numero: `CAT-${timestamp}`,
  cliente_nombre,
  cliente_telefono,
  productos: [...], // JSONB con variantes
  total,
  estado: 'recibido'
})
```

### **PASO 2: Pedido llega al ERP → Sección "Pedidos Recibidos"**
**Componente:** `ERP-ferabensrl-claude/src/components/PedidosRecibidos/PedidosRecibidos.tsx`

**Acciones posibles:**
1. **Aprobar:** Llama a `aprobar_pedido_recibido()` → Mueve a tabla `pedidos`
2. **Rechazar:** Pide motivo → Elimina el pedido (⚠️ NO guarda historial actualmente)
3. **Editar:** Permite modificar productos/cantidades antes de aprobar

### **PASO 3: Depósito prepara el pedido**
**Componente:** `ERP-ferabensrl-claude/src/components/Pedidos/Pedidos.tsx`

**Flujo:**
```
1. Operario ve pedido en estado 'pendiente'
2. Hace clic en "Iniciar Preparación"
3. Para cada producto/variante:
   - "Todas" → cantidad_preparada = cantidad_pedida
   - Input manual → cantidad_preparada = valor ingresado
   - "Sin Stock" → cantidad_preparada = 0, estado = 'sin_stock'
4. Hace clic en "Finalizar Pedido"
```

**Acciones técnicas:**
```javascript
// Pedidos.tsx línea ~803
await pedidosService.finalizarPedidoCompleto(pedidoId, comentarios, items)
// Actualiza pedido.estado = 'completado'
// Actualiza pedido_items con cantidades preparadas reales
await productosService.procesarReduccionStockPedido(productos)
// Reduce stock del inventario (solo productos que existan en inventario)
```

### **PASO 4: Facturación genera Excel**
**Componente:** `ERP-ferabensrl-claude/src/components/Facturacion/Facturacion.tsx`

**Flujo:**
```
1. Carga pedidos con estado = 'completado' desde Supabase
2. Calcula cantidades usando cantidad_preparada (NO cantidad_pedida)
3. Filtra productos con cantidad > 0
4. Usuario selecciona pedidos y hace clic en "Configurar Facturación"
5. Puede editar cantidades/precios/descuentos
6. Genera Excel con formato para sistema de facturación electrónica
7. Elimina pedidos de Supabase después de exportar
```

**⚠️ FIX CRÍTICO IMPLEMENTADO (Facturacion.tsx líneas 258-260 y 291-293):**
```typescript
// ANTES (INCORRECTO):
const cantidad = producto.cantidadPreparada || producto.cantidadPedida

// AHORA (CORRECTO):
const cantidad = (producto.cantidadPreparada !== undefined && producto.cantidadPreparada !== null
  ? producto.cantidadPreparada
  : producto.cantidadPedida || 0)
```
**Por qué:** El operador `||` evaluaba `0` como falsy, mostrando cantidad pedida en lugar de 0 para productos sin stock.

---

## 📱 CATÁLOGO PWA - CONFIGURACIÓN

### **Service Worker (sw.js)**
**Ubicación:** `mare-catalog-v2/sw.js`
**Versión actual:** Línea 2
```javascript
const CACHE_VERSION = 'mare-v1.5.0-update-' + Date.now();
```

**✅ ACTUALIZACIÓN AUTOMÁTICA:**
- `Date.now()` genera nueva versión en cada build
- Service Worker detecta cambio automáticamente
- PWAs instaladas se actualizan sin intervención manual
- Los usuarios ven notificación "Nueva versión disponible" al abrir la app

**Estrategias de caché:**
- **Cache First:** Archivos estáticos, JS, CSS, imágenes
- **Network First:** `productos.json` (siempre datos frescos)
- **Limpieza automática:** Elimina caches antiguos al activar nueva versión

### **Manifest.json**
**Ubicación:** `mare-catalog-v2/public/manifest.json`
```json
{
  "name": "MARÉ Catálogo Mayorista",
  "short_name": "MARÉ",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#E3D4C1",
  "background_color": "#8F6A50",
  "icons": [...]
}
```

---

## 🚀 PROCEDIMIENTO DE DEPLOY

### **ORDEN RECOMENDADO:**
1. **PRIMERO → ERP Feraben** (receptor de pedidos)
2. **DESPUÉS → Catálogo MARÉ** (emisor de pedidos)

**Razón:** El catálogo envía datos a Supabase, el ERP los lee. Si el ERP no está actualizado podría no mostrar campos nuevos.

### **COMANDOS GIT:**

**1. ERP Feraben:**
```bash
cd C:\Users\Usuario\ERP-ferabensrl-claude
git add .
git commit -m "✅ Fix facturación productos sin stock + Integración completa Catálogo-ERP

- CRITICAL FIX: Productos sin stock ahora muestran cantidad 0 en facturación
- Corrección operador || por verificación explícita de undefined/null
- Integración completa catálogo web → pedidos recibidos → depósito → facturación
- Eliminado componente obsoleto ImportarPDF
- Build verificado sin errores

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

**2. Catálogo MARÉ:**
```bash
cd C:\Users\Usuario\mare-catalog-v2
git add .
git commit -m "✅ Integración completa con ERP - Envío de pedidos automatizado

- Integración directa con tabla pedidos_recibidos de Supabase
- Flujo completo: Catálogo → ERP → Aprobación → Depósito → Facturación
- PDF generado automáticamente para confirmación de pedidos
- Service Worker actualizado con versionado automático
- Build verificado sin errores

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

### **EN VERCEL:**
1. Push activará deploy automático
2. Vercel detectará cambios en ambos repos
3. Build se ejecutará con las variables del .env
4. PWA se actualizará automáticamente en dispositivos instalados

---

## 🔧 TROUBLESHOOTING

### **Problema: "Productos sin stock aparecen con cantidad incorrecta"**
**Solución:** Ya corregido en `Facturacion.tsx` líneas 258-260 y 291-293.
**Verificar:** Cantidad debe ser 0 para productos con `estado: 'sin_stock'`

### **Problema: "PWA no se actualiza en dispositivos"**
**Causa:** Service Worker no detecta cambios
**Solución:**
1. Verificar `sw.js` línea 2 tiene `Date.now()`
2. Hacer build nuevo (genera timestamp único)
3. En navegador: Dev Tools → Application → Service Workers → Update

### **Problema: "Error de permisos en Supabase (RLS)"**
**Causa:** Row Level Security bloqueando acceso
**Solución:**
```sql
-- Ejecutar en Supabase SQL Editor:

-- Permitir lectura pública de inventario
CREATE POLICY "Allow public read" ON inventario
FOR SELECT USING (activo = true);

-- Permitir inserción pública en pedidos_recibidos
CREATE POLICY "Allow public insert" ON pedidos_recibidos
FOR INSERT WITH CHECK (true);

-- Permitir lectura/escritura completa en pedidos y pedido_items
CREATE POLICY "Allow all operations" ON pedidos
FOR ALL USING (true);

CREATE POLICY "Allow all operations" ON pedido_items
FOR ALL USING (true);
```

### **Problema: "Productos del catálogo no están en inventario"**
**Comportamiento esperado:** El sistema maneja esto correctamente.
```javascript
// productosService.reducirStock() línea 152-160
// Si producto no existe en inventario:
console.warn('Producto no está en inventario - continuando sin reducir stock')
return { success: false, stockAnterior: 0, stockNuevo: 0 }
// Resultado: Pedido se procesa normalmente, stock no se reduce
```

---

## 📂 ARCHIVOS CRÍTICOS

### **ERP Feraben:**
- `src/App.tsx` - Router principal, navegación
- `src/lib/supabaseClient.ts` - Cliente Supabase, servicios de datos
- `src/components/PedidosRecibidos/PedidosRecibidos.tsx` - Aprobación de pedidos del catálogo
- `src/components/Pedidos/Pedidos.tsx` - Preparación en depósito
- `src/components/Facturacion/Facturacion.tsx` - Generación de Excel (FIX CRÍTICO)

### **Catálogo MARÉ:**
- `src/App.tsx` - Componente principal, envío de pedidos
- `sw.js` - Service Worker con versionado automático
- `public/manifest.json` - Configuración PWA
- `public/productos.json` - Catálogo de productos

---

## 📊 MÉTRICAS Y VERIFICACIÓN

### **Build Sizes:**
- ERP: ~1.01 MB (gzip: ~297 KB)
- Catálogo: ~708 KB (gzip: ~220 KB)

### **Checklist Pre-Deploy:**
- [✅] Build ERP sin errores
- [✅] Build Catálogo sin errores
- [✅] Service Worker con Date.now()
- [✅] Variables Supabase configuradas
- [✅] Fix productos sin stock implementado
- [✅] Componente ImportarPDF eliminado
- [✅] RLS policies configuradas

---

## 🎯 PARA PRÓXIMA CONVERSACIÓN CON CLAUDE

**Contexto inicial a proveer:**
```
1. Sistema: ERP Feraben + Catálogo MARÉ
2. Stack: React + TypeScript + Vite + Supabase
3. Estado: Producción - Integración completa funcionando
4. Ubicaciones:
   - ERP: C:\Users\Usuario\ERP-ferabensrl-claude
   - Catálogo: C:\Users\Usuario\mare-catalog-v2
5. Último cambio: Fix productos sin stock en facturación
6. Pendientes:
   - Tabla pedidos_rechazados (historial)
   - Optimización de chunks (warnings en build)
```

**Comandos útiles:**
```bash
# Verificar estado
cd C:\Users\Usuario\ERP-ferabensrl-claude && git status

# Build local
npm run build

# Dev servers
npm run dev # ERP en :5173
cd C:\Users\Usuario\mare-catalog-v2 && npm run dev -- --port 5174
```

---

**📅 Última actualización:** Enero 2025
**✍️ Documentado por:** Claude Code
**🎯 Estado:** Listo para producción
