# 🎯 PLAN COMPLETO DE IMPLEMENTACIÓN: INTEGRACIÓN DIRECTA CATÁLOGO → ERP

**Fecha:** 9 de Octubre 2025
**Proyecto:** Feraben SRL - Integración Catálogo Web → ERP
**Estado:** DOCUMENTACIÓN PRE-IMPLEMENTACIÓN
**Objetivo:** Eliminar dependencia de WhatsApp y crear flujo directo con modo offline robusto

---

## 📋 ÍNDICE

1. [Contexto y Decisiones Clave](#contexto)
2. [Análisis del Flujo Actual](#flujo-actual)
3. [Flujo Nuevo Propuesto](#flujo-nuevo)
4. [Arquitectura Técnica Detallada](#arquitectura)
5. [Plan de Implementación Paso a Paso](#implementacion)
6. [Casos de Uso y Testing](#testing)
7. [Rollback y Contingencias](#rollback)

---

## 🎯 CONTEXTO Y DECISIONES CLAVE {#contexto}

### **Problema Actual**
- Catálogo envía pedidos por WhatsApp (límite ~4096 caracteres)
- Proceso manual de copiar/pegar en ERP
- Pedidos grandes se cortan
- Parsing complejo con WhatsAppConverter.tsx (1928 líneas)
- Propenso a errores humanos

### **Solución Acordada**
- **Envío directo** desde Catálogo a Supabase
- **Nueva sección ERP:** "Pedidos Recibidos" para control de calidad
- **PDF automático** descargado al cliente/vendedor
- **Modo offline robusto** con cola de sincronización
- **Mantener WhatsApp temporalmente** como fallback hasta confirmar que todo funciona

### **Decisiones Críticas**
1. ✅ **UN SOLO BOTÓN:** "📤 Enviar Pedido" (eliminar los 4 botones actuales después de testing)
2. ✅ **No romper nada:** Sistema actual sigue funcionando en paralelo
3. ✅ **Quirúrgico:** Entender cada paso del flujo actual antes de modificar
4. ✅ **Testing completo:** Implementar todo junto y probar flujo end-to-end
5. ✅ **Mismo formato:** Datos deben llegar a facturación exactamente igual que ahora

---

## 📊 ANÁLISIS DEL FLUJO ACTUAL {#flujo-actual}

### **CATÁLOGO (mare-catalog-v2/src/App.tsx)**

#### 1. **Estructura del Carrito**
```typescript
interface CartItem {
  producto: Product;          // Producto completo con todos los datos
  selecciones: { [key: string]: number };  // Ej: {"Negro": 2, "Rojo": 3}
  surtido?: number;           // Cantidad surtida (opcional)
  comentario?: string;        // Comentario del producto
}

interface Product {
  codigo: string;             // "LB001"
  nombre: string;             // "Cinto de dama negro"
  descripcion: string;
  categoria: string;
  medidas: string;
  precio: number;             // Precio unitario
  imagenes: string[];
  imagenVariantes?: string;
  sinColor: boolean;
  permitirSurtido: boolean;
  estado: string;
  colores: { [key: string]: boolean };
  variantes: { [key: string]: boolean };
}
```

#### 2. **Persistencia Actual (localStorage)**
```typescript
// Al cargar la app (línea 1178-1202)
useEffect(() => {
  const savedCart = localStorage.getItem('mare-cart');
  const savedLoginData = localStorage.getItem('mare-login');

  if (savedCart) {
    setCart(JSON.parse(savedCart)); // Restaura carrito
  }

  if (savedLoginData) {
    setLoginData(JSON.parse(savedLoginData)); // Restaura login
    setIsLoggedIn(true);
  }
}, []);

// Al cambiar el carrito (línea 1205-1211)
useEffect(() => {
  if (cart.length > 0) {
    localStorage.setItem('mare-cart', JSON.stringify(cart));
  } else {
    localStorage.removeItem('mare-cart');
  }
}, [cart]);

// Último pedido enviado (24h) (línea 746-767)
const saveLastOrder = () => {
  const orderData = {
    cart: cart,
    clientName: clientName,
    timestamp: Date.now(),
    totalItems: getTotalItems(),
    totalPrice: totalPrice
  };
  localStorage.setItem('mare_last_order', JSON.stringify(orderData));
};
```

#### 3. **Generación de Mensaje WhatsApp (línea 1504-1531)**
```typescript
const generateWhatsAppMessage = (comentarioFinal: string = '') => {
  const fecha = new Date().toLocaleDateString('es-AR');
  let mensaje = `📲 NUEVO PEDIDO – ${fecha}\n👤 Cliente: ${loginData?.nombreCliente}\n\n📦 *Detalle del pedido:*\n\n`;

  cart.forEach(item => {
    mensaje += `🔹 ${item.producto.codigo} – ${item.producto.nombre}\n`;

    // Variantes (colores)
    Object.entries(item.selecciones).forEach(([opcion, cantidad]) => {
      if (cantidad > 0) {
        mensaje += `- ${opcion}: ${cantidad}\n`;
      }
    });

    // Surtido
    if (item.surtido && item.surtido > 0) {
      mensaje += `- Surtido: ${item.surtido}\n`;
    }

    // Comentario del producto
    mensaje += `📝 Comentario: ${item.comentario || ''}\n\n`;
  });

  // Comentario final del pedido
  if (comentarioFinal) {
    mensaje += `✍️ *Comentario final:* ${comentarioFinal}\n\n`;
  }

  mensaje += `🥳 ¡Gracias por tu pedido y por elegirnos! 🙌🏻`;

  return encodeURIComponent(mensaje);
};
```

#### 4. **Flujo de Envío Actual (línea 870-911)**
```typescript
const handleWhatsAppSend = async () => {
  setIsLoading(true);
  const message = onGenerateWhatsApp(comentarioFinal);

  // 1. Guardar último pedido (para restaurar en 24h)
  saveLastOrder();

  // 2. Abrir WhatsApp
  window.open(`https://wa.me/59897998999?text=${message}`, '_blank');

  // 3. Esperar 1.5 segundos y limpiar
  setTimeout(() => {
    setIsLoading(false);
    onClearCart();      // Vacía el carrito
    onClose();          // Cierra el modal
    alert('¡Pedido enviado por WhatsApp! 🎉\n\nLa aplicación se ha reiniciado para un nuevo pedido.');
  }, 1500);
};
```

#### 5. **Cálculos de Total**
```typescript
// Total de items (línea 1467-1472)
const getTotalItems = () => {
  return cart.reduce((total, item) => {
    const itemTotal = Object.values(item.selecciones).reduce((sum, qty) => sum + qty, 0) + (item.surtido || 0);
    return total + itemTotal;
  }, 0);
};

// Total en precio (línea 1474-1479)
const getTotalPrice = () => {
  return cart.reduce((total, item) => {
    const itemTotal = Object.values(item.selecciones).reduce((sum, qty) => sum + qty, 0) + (item.surtido || 0);
    return total + (itemTotal * item.producto.precio);
  }, 0);
};
```

---

### **ERP - FLUJO DE RECEPCIÓN ACTUAL**

#### 1. **WhatsAppConverter.tsx** (Proceso manual actual)
```typescript
// Usuario copia mensaje de WhatsApp
// Pega en textarea del ERP
// Sistema parsea con regex complejo:

// Detecta cliente
const clienteMatch = mensajeLimpio.match(/👤 Cliente:\s*(.+)/);
// O fallback WhatsApp Web
if (!clienteMatch) {
  clienteMatch = mensajeLimpio.match(/� Cliente:\s*(.+)/);
}

// Detecta productos
const bloques = mensajeLimpio.split('🔹').filter(b => b.trim());
bloques.forEach(bloque => {
  // Extrae código y nombre
  const matchProducto = bloque.match(/([A-Z0-9-]+(?:\s+[A-Z0-9]+)*)\s*[–-]\s*([^\n]+)/);

  // Extrae variantes
  const lineas = bloque.split('\n');
  lineas.forEach(linea => {
    if (linea.includes('-') && linea.includes(':')) {
      // Parse color y cantidad
    }
  });
});

// Crea pedido en Supabase
await pedidosService.insertPedidoWithItems(pedido, items);
```

#### 2. **Estructura en Supabase ACTUAL**

**Tabla: `pedidos`**
```sql
CREATE TABLE pedidos (
  id UUID PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,          -- "PED-001234"
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT,
  cliente_direccion TEXT,
  fecha_pedido TIMESTAMP DEFAULT NOW(),
  estado TEXT DEFAULT 'pendiente',      -- pendiente → preparando → completado → entregado
  origen TEXT,                          -- 'whatsapp' | 'manual'
  comentarios TEXT,                     -- Comentarios del operario
  total NUMERIC(10,2),
  productos JSONB,                      -- Resumen JSON (legacy)
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tabla: `pedido_items`**
```sql
CREATE TABLE pedido_items (
  id UUID PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  cantidad_pedida INTEGER NOT NULL,
  cantidad_preparada INTEGER DEFAULT 0,
  precio_unitario NUMERIC(10,2),
  estado TEXT DEFAULT 'pendiente',      -- pendiente | completado | sin_stock
  variante_color TEXT,                  -- "Negro", "Rojo", "Surtido"
  comentarios TEXT,                     -- Comentario del producto
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. **Pedidos.tsx - Vista de Depósito (líneas 1-100)**
```typescript
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

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  estado: 'pendiente' | 'completado' | 'sin_stock';
  precio?: number;
  variantes?: VarianteProducto[];
  comentarioProducto?: string;
}
```

#### 4. **Facturación - Formato CRÍTICO**

**IMPORTANTE:** Los datos deben llegar a facturación EXACTAMENTE así:

```typescript
// src/components/Facturacion/Facturacion.tsx
// El sistema espera pedidos con estado 'completado'
// Y los convierte a Excel con este formato:

interface FacturaExport {
  numero_factura: string;
  cliente: string;
  fecha: string;
  productos: Array<{
    codigo: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  total: number;
}

// Este Excel es el que usa el sistema de facturación electrónica
```

---

## 🚀 FLUJO NUEVO PROPUESTO {#flujo-nuevo}

### **DIAGRAMA COMPLETO**

```
┌─────────────────────────────────────────────────────────────┐
│                   CATÁLOGO (Cliente/Vendedor)               │
│                                                             │
│  1. Agrega productos al carrito                             │
│     └─> localStorage.setItem('mare-cart', cart)            │
│                                                             │
│  2. Click botón: "📤 Enviar Pedido"                        │
│     ↓                                                       │
│  3. Detectar estado de internet                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
    ¿Tiene Internet?                │
        │                           │
  ┌─────┴──────┐           ┌────────┴────────┐
  │    SÍ      │           │      NO         │
  └─────┬──────┘           └────────┬────────┘
        │                           │
        ↓                           ↓
┌───────────────────┐      ┌────────────────────┐
│  FLUJO ONLINE     │      │  FLUJO OFFLINE     │
├───────────────────┤      ├────────────────────┤
│ 1. Validar datos  │      │ 1. Validar datos   │
│ 2. Generar número │      │ 2. Generar número  │
│ 3. Enviar a       │      │ 3. Guardar en      │
│    Supabase       │      │    localStorage:   │
│    (pedidos_      │      │    'pedido_        │
│     recibidos)    │      │     pendiente'     │
│ 4. Generar PDF    │      │ 4. Generar PDF     │
│ 5. Descargar PDF  │      │ 5. Descargar PDF   │
│ 6. Mostrar ✅     │      │ 6. Mostrar ⏳      │
│ 7. Limpiar carrito│      │ 7. Iniciar monitor │
└────────┬──────────┘      └──────────┬─────────┘
         │                            │
         │                   ┌────────┴─────────┐
         │                   │ Monitor detecta  │
         │                   │ conexión activa  │
         │                   └────────┬─────────┘
         │                            │
         │                   ┌────────┴─────────┐
         │                   │ Auto-enviar a    │
         │                   │ Supabase         │
         │                   └────────┬─────────┘
         │                            │
         │                   ┌────────┴─────────┐
         │                   │ Limpiar          │
         │                   │ localStorage     │
         │                   └────────┬─────────┘
         │                            │
         └────────────┬───────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE - Nueva Tabla: pedidos_recibidos      │
│                                                             │
│  {                                                          │
│    id: "uuid-generado",                                     │
│    numero: "CAT-123456",                                    │
│    cliente_nombre: "Juan Pérez",                            │
│    cliente_telefono: "",                                    │
│    cliente_direccion: "",                                   │
│    fecha_pedido: "2025-10-09T14:30:00Z",                   │
│    estado: "recibido",                                      │
│    origen: "catalogo_web",                                  │
│    productos: [                                             │
│      {                                                      │
│        codigo: "LB001",                                     │
│        nombre: "Cinto de dama negro",                       │
│        precio_unitario: 450,                                │
│        variantes: [                                         │
│          { color: "Negro", cantidad: 2 },                   │
│          { color: "Marrón", cantidad: 3 }                   │
│        ],                                                   │
│        surtido: 0,                                          │
│        comentario: "Sin flecos"                             │
│      }                                                      │
│    ],                                                       │
│    comentario_final: "Urgente para el viernes",            │
│    total: 2250.00,                                          │
│    created_at: "2025-10-09T14:30:00Z"                      │
│  }                                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ (Realtime subscription)
┌─────────────────────────────────────────────────────────────┐
│        ERP - NUEVA SECCIÓN: "Pedidos Recibidos" 🆕          │
│                                                             │
│  📋 VISTA LISTA                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔔 3 pedidos nuevos                                  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ CAT-123456 • Juan Pérez • $2,250 • 5 productos      │  │
│  │ CAT-123457 • María González • $1,800 • 3 productos  │  │
│  │ CAT-123458 • Pedro Martínez • $3,200 • 8 productos  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  👁️ VISTA DETALLE (al hacer click en un pedido)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Pedido: CAT-123456                                   │  │
│  │ Cliente: Juan Pérez                                  │  │
│  │ Fecha: 09/10/2025 14:30                             │  │
│  │                                                      │  │
│  │ PRODUCTOS:                                           │  │
│  │ ┌─────────────────────────────────────────────────┐ │  │
│  │ │ LB001 - Cinto de dama negro                     │ │  │
│  │ │ • Negro: [2] 🔽 [Editar] [❌]                   │ │  │
│  │ │ • Marrón: [3] 🔽 [Editar] [❌]                  │ │  │
│  │ │ 💬 Comentario: "Sin flecos"                      │ │  │
│  │ │                                                  │ │  │
│  │ │ [➕ Agregar variante]                            │ │  │
│  │ └─────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │ [➕ Agregar otro producto]                           │  │
│  │                                                      │  │
│  │ 📝 Comentario final: "Urgente para el viernes"      │  │
│  │                                                      │  │
│  │ TOTAL: $2,250.00                                     │  │
│  │                                                      │  │
│  │ [✅ Aprobar y Enviar a Depósito]  [❌ Rechazar]     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ (Al aprobar → mover datos)
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE - Tabla Existente: pedidos            │
│                                                             │
│  TRANSACCIÓN:                                               │
│  1. INSERT INTO pedidos (...)                               │
│  2. INSERT INTO pedido_items (...) [múltiples filas]       │
│  3. DELETE FROM pedidos_recibidos WHERE id = ...            │
│                                                             │
│  Resultado:                                                 │
│  pedidos:                                                   │
│  {                                                          │
│    numero: "CAT-123456",                                    │
│    estado: "pendiente", ← Estado inicial para depósito     │
│    ...resto de datos                                        │
│  }                                                          │
│                                                             │
│  pedido_items: (3 filas separadas)                         │
│  { pedido_id: "...", codigo_producto: "LB001",             │
│    variante_color: "Negro", cantidad_pedida: 2, ... }      │
│  { pedido_id: "...", codigo_producto: "LB001",             │
│    variante_color: "Marrón", cantidad_pedida: 3, ... }     │
│  { pedido_id: "...", codigo_producto: "LB002", ... }       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│           ERP - Sección ACTUAL: "Pedidos" (Depósito)       │
│                                                             │
│  👷 Depósito ve el pedido aprobado                          │
│  (TODO SIGUE IGUAL QUE AHORA)                               │
│                                                             │
│  1. Ver lista de pedidos pendientes                         │
│  2. Iniciar preparación                                     │
│  3. Marcar productos preparados                             │
│  4. Completar pedido                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                 ERP - Facturación                           │
│                                                             │
│  (FORMATO EXACTO IGUAL QUE AHORA)                           │
│                                                             │
│  1. Consulta pedidos con estado 'completado'                │
│  2. Genera Excel con mismo formato                          │
│  3. Descarga para facturación electrónica                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ ARQUITECTURA TÉCNICA DETALLADA {#arquitectura}

### **FASE 1: Base de Datos Supabase**

#### **Nueva Tabla: `pedidos_recibidos`**

```sql
-- ============================================
-- TABLA: pedidos_recibidos
-- Propósito: Recibir pedidos del catálogo web
--           antes de aprobarlos para depósito
-- ============================================

CREATE TABLE pedidos_recibidos (
  -- Identificación
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,          -- "CAT-123456" (generado en frontend)

  -- Cliente
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT,
  cliente_direccion TEXT,

  -- Metadatos del pedido
  fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estado TEXT DEFAULT 'recibido' CHECK (estado IN ('recibido', 'revisando', 'aprobado', 'rechazado')),
  origen TEXT DEFAULT 'catalogo_web' CHECK (origen IN ('catalogo_web', 'whatsapp_legacy')),

  -- Datos del pedido (JSONB para máxima flexibilidad)
  productos JSONB NOT NULL,
  /* Estructura de productos:
  [
    {
      "codigo": "LB001",
      "nombre": "Cinto de dama negro",
      "precio_unitario": 450,
      "descripcion": "...",
      "categoria": "...",
      "variantes": [
        {
          "color": "Negro",
          "cantidad": 2
        },
        {
          "color": "Marrón",
          "cantidad": 3
        }
      ],
      "surtido": 0,
      "comentario": "Sin flecos"
    }
  ]
  */

  -- Comentarios
  comentario_final TEXT,                -- Comentario del cliente/vendedor
  comentarios_admin TEXT,               -- Comentarios del admin al revisar

  -- Totales
  total NUMERIC(10,2) NOT NULL,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aprobado_por TEXT,                    -- ID del usuario que aprobó
  aprobado_en TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- ÍNDICES para performance
-- ============================================
CREATE INDEX idx_pedidos_recibidos_estado ON pedidos_recibidos(estado);
CREATE INDEX idx_pedidos_recibidos_fecha ON pedidos_recibidos(fecha_pedido DESC);
CREATE INDEX idx_pedidos_recibidos_numero ON pedidos_recibidos(numero);
CREATE INDEX idx_pedidos_recibidos_origen ON pedidos_recibidos(origen);

-- ============================================
-- TRIGGER para updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pedidos_recibidos_updated_at
BEFORE UPDATE ON pedidos_recibidos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE pedidos_recibidos ENABLE ROW LEVEL SECURITY;

-- Política 1: Catálogo puede insertar
CREATE POLICY "Catalogo_insertar_pedidos"
ON pedidos_recibidos FOR INSERT
TO anon, authenticated
WITH CHECK (origen = 'catalogo_web');

-- Política 2: ERP puede leer todos
CREATE POLICY "ERP_leer_pedidos_recibidos"
ON pedidos_recibidos FOR SELECT
TO authenticated
USING (true);

-- Política 3: ERP puede actualizar
CREATE POLICY "ERP_actualizar_pedidos_recibidos"
ON pedidos_recibidos FOR UPDATE
TO authenticated
USING (true);

-- Política 4: ERP puede eliminar (al aprobar)
CREATE POLICY "ERP_eliminar_pedidos_recibidos"
ON pedidos_recibidos FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- FUNCIÓN: Aprobar pedido y mover a producción
-- ============================================
CREATE OR REPLACE FUNCTION aprobar_pedido_recibido(
  p_pedido_recibido_id UUID,
  p_usuario_aprobador TEXT
)
RETURNS TABLE (
  nuevo_pedido_id UUID,
  nuevo_pedido_numero TEXT
) AS $$
DECLARE
  v_pedido_recibido pedidos_recibidos%ROWTYPE;
  v_nuevo_pedido_id UUID;
  v_producto JSONB;
  v_variante JSONB;
BEGIN
  -- 1. Obtener pedido recibido
  SELECT * INTO v_pedido_recibido
  FROM pedidos_recibidos
  WHERE id = p_pedido_recibido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido recibido no encontrado: %', p_pedido_recibido_id;
  END IF;

  -- 2. Crear pedido en tabla principal
  INSERT INTO pedidos (
    numero,
    cliente_nombre,
    cliente_telefono,
    cliente_direccion,
    fecha_pedido,
    estado,
    origen,
    comentarios,
    total,
    productos
  ) VALUES (
    v_pedido_recibido.numero,
    v_pedido_recibido.cliente_nombre,
    v_pedido_recibido.cliente_telefono,
    v_pedido_recibido.cliente_direccion,
    v_pedido_recibido.fecha_pedido,
    'pendiente',  -- Estado inicial para depósito
    v_pedido_recibido.origen,
    COALESCE(v_pedido_recibido.comentario_final, '') ||
      CASE
        WHEN v_pedido_recibido.comentarios_admin IS NOT NULL
        THEN E'\n\n[Admin]: ' || v_pedido_recibido.comentarios_admin
        ELSE ''
      END,
    v_pedido_recibido.total,
    v_pedido_recibido.productos
  )
  RETURNING id INTO v_nuevo_pedido_id;

  -- 3. Crear pedido_items individuales
  FOR v_producto IN SELECT * FROM jsonb_array_elements(v_pedido_recibido.productos)
  LOOP
    -- 3a. Items de variantes (colores)
    FOR v_variante IN SELECT * FROM jsonb_array_elements(v_producto->'variantes')
    LOOP
      INSERT INTO pedido_items (
        pedido_id,
        codigo_producto,
        cantidad_pedida,
        cantidad_preparada,
        precio_unitario,
        estado,
        variante_color,
        comentarios
      ) VALUES (
        v_nuevo_pedido_id,
        v_producto->>'codigo',
        (v_variante->>'cantidad')::INTEGER,
        0,
        (v_producto->>'precio_unitario')::NUMERIC,
        'pendiente',
        v_variante->>'color',
        v_producto->>'comentario'
      );
    END LOOP;

    -- 3b. Item de surtido (si existe y es > 0)
    IF (v_producto->>'surtido')::INTEGER > 0 THEN
      INSERT INTO pedido_items (
        pedido_id,
        codigo_producto,
        cantidad_pedida,
        cantidad_preparada,
        precio_unitario,
        estado,
        variante_color,
        comentarios
      ) VALUES (
        v_nuevo_pedido_id,
        v_producto->>'codigo',
        (v_producto->>'surtido')::INTEGER,
        0,
        (v_producto->>'precio_unitario')::NUMERIC,
        'pendiente',
        'Surtido',
        v_producto->>'comentario'
      );
    END IF;
  END LOOP;

  -- 4. Marcar pedido recibido como aprobado
  UPDATE pedidos_recibidos
  SET estado = 'aprobado',
      aprobado_por = p_usuario_aprobador,
      aprobado_en = NOW()
  WHERE id = p_pedido_recibido_id;

  -- 5. Eliminar de pedidos_recibidos (opcional, o dejar para historial)
  -- DELETE FROM pedidos_recibidos WHERE id = p_pedido_recibido_id;

  -- 6. Retornar info del nuevo pedido
  RETURN QUERY
  SELECT v_nuevo_pedido_id, v_pedido_recibido.numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### **FASE 2: Catálogo - Implementación**

#### **Archivo 1: `mare-catalog-v2/src/lib/supabaseClient.ts`** (NUEVO)

```typescript
import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURACIÓN SUPABASE
// ============================================
// IMPORTANTE: Usar las MISMAS credenciales que el ERP
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan credenciales de Supabase en variables de entorno');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// TIPOS PARA PEDIDOS RECIBIDOS
// ============================================
export interface PedidoRecibidoProducto {
  codigo: string;
  nombre: string;
  precio_unitario: number;
  descripcion: string;
  categoria: string;
  variantes: Array<{
    color: string;
    cantidad: number;
  }>;
  surtido: number;
  comentario: string;
}

export interface PedidoRecibido {
  id?: string;
  numero: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  fecha_pedido: string;
  estado: 'recibido';
  origen: 'catalogo_web';
  productos: PedidoRecibidoProducto[];
  comentario_final?: string;
  total: number;
}

// ============================================
// SERVICIO: Enviar pedido a Supabase
// ============================================
export const pedidosRecibidosService = {
  /**
   * Insertar nuevo pedido recibido desde catálogo
   */
  async insert(pedido: PedidoRecibido) {
    console.log('📤 Enviando pedido a Supabase:', pedido.numero);

    const { data, error } = await supabase
      .from('pedidos_recibidos')
      .insert([pedido])
      .select()
      .single();

    if (error) {
      console.error('❌ Error insertando pedido:', error);
      throw error;
    }

    console.log('✅ Pedido insertado exitosamente:', data);
    return data;
  },

  /**
   * Verificar si hay conexión a Supabase
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pedidos_recibidos')
        .select('count')
        .limit(1);

      return !error;
    } catch (e) {
      console.error('❌ No hay conexión a Supabase:', e);
      return false;
    }
  }
};
```

#### **Archivo 2: `mare-catalog-v2/src/lib/offlineSync.ts`** (NUEVO)

```typescript
import { supabase, pedidosRecibidosService, PedidoRecibido } from './supabaseClient';

// ============================================
// GESTIÓN DE COLA OFFLINE
// ============================================

const STORAGE_KEY = 'mare_pedidos_pendientes';
const RETRY_INTERVAL = 30000; // 30 segundos

interface PedidoPendiente {
  id: string;
  pedido: PedidoRecibido;
  timestamp: number;
  intentos: number;
}

/**
 * Guardar pedido en cola offline
 */
export const guardarPedidoOffline = (pedido: PedidoRecibido): string => {
  const pedidosPendientes = obtenerPedidosPendientes();

  const nuevoPedido: PedidoPendiente = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    pedido,
    timestamp: Date.now(),
    intentos: 0
  };

  pedidosPendientes.push(nuevoPedido);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosPendientes));

  console.log('💾 Pedido guardado offline:', nuevoPedido.id);
  return nuevoPedido.id;
};

/**
 * Obtener pedidos pendientes de envío
 */
export const obtenerPedidosPendientes = (): PedidoPendiente[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error leyendo pedidos pendientes:', e);
    return [];
  }
};

/**
 * Eliminar pedido de la cola
 */
export const eliminarPedidoPendiente = (id: string): void => {
  const pedidos = obtenerPedidosPendientes();
  const filtrados = pedidos.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
  console.log('🗑️ Pedido eliminado de cola offline:', id);
};

/**
 * Intentar sincronizar pedidos pendientes
 */
export const sincronizarPedidosPendientes = async (): Promise<{
  exitosos: number;
  fallidos: number;
}> => {
  const pedidos = obtenerPedidosPendientes();

  if (pedidos.length === 0) {
    return { exitosos: 0, fallidos: 0 };
  }

  console.log(`🔄 Sincronizando ${pedidos.length} pedidos pendientes...`);

  let exitosos = 0;
  let fallidos = 0;

  for (const pedidoPendiente of pedidos) {
    try {
      // Intentar enviar
      await pedidosRecibidosService.insert(pedidoPendiente.pedido);

      // Si fue exitoso, eliminar de la cola
      eliminarPedidoPendiente(pedidoPendiente.id);
      exitosos++;

      console.log('✅ Pedido sincronizado:', pedidoPendiente.pedido.numero);
    } catch (error) {
      console.error('❌ Error sincronizando pedido:', pedidoPendiente.pedido.numero, error);

      // Incrementar contador de intentos
      pedidoPendiente.intentos++;

      // Si superó 10 intentos, marcar como fallido permanentemente
      if (pedidoPendiente.intentos >= 10) {
        console.error('💥 Pedido superó límite de intentos:', pedidoPendiente.pedido.numero);
        // Mover a cola de errores
        moverAColaErrores(pedidoPendiente);
        eliminarPedidoPendiente(pedidoPendiente.id);
      }

      fallidos++;
    }
  }

  // Actualizar localStorage con intentos incrementados
  const pedidosActualizados = obtenerPedidosPendientes();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosActualizados));

  return { exitosos, fallidos };
};

/**
 * Mover pedido a cola de errores
 */
const moverAColaErrores = (pedido: PedidoPendiente): void => {
  const errores = JSON.parse(localStorage.getItem('mare_pedidos_errores') || '[]');
  errores.push({
    ...pedido,
    error_timestamp: Date.now()
  });
  localStorage.setItem('mare_pedidos_errores', JSON.stringify(errores));
};

/**
 * Iniciar monitor de conexión
 */
export const iniciarMonitorConexion = (): (() => void) => {
  let intervalId: NodeJS.Timeout;

  const verificarYSincronizar = async () => {
    // Solo intentar si hay pedidos pendientes
    const pedidos = obtenerPedidosPendientes();
    if (pedidos.length === 0) return;

    // Verificar conexión
    const hayConexion = await pedidosRecibidosService.testConnection();

    if (hayConexion) {
      console.log('🌐 Conexión detectada, sincronizando...');
      const resultado = await sincronizarPedidosPendientes();

      if (resultado.exitosos > 0) {
        // Notificar al usuario
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pedidos sincronizados', {
            body: `${resultado.exitosos} pedido(s) enviado(s) exitosamente`,
            icon: '/logo-mare.png'
          });
        }
      }
    }
  };

  // Ejecutar cada 30 segundos
  intervalId = setInterval(verificarYSincronizar, RETRY_INTERVAL);

  // También verificar al obtener foco
  const handleFocus = () => verificarYSincronizar();
  window.addEventListener('focus', handleFocus);

  // También verificar al detectar evento online
  const handleOnline = () => verificarYSincronizar();
  window.addEventListener('online', handleOnline);

  // Retornar función de limpieza
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * Verificar si hay internet
 */
export const hayInternet = (): boolean => {
  return navigator.onLine;
};

/**
 * Obtener cantidad de pedidos pendientes
 */
export const cantidadPedidosPendientes = (): number => {
  return obtenerPedidosPendientes().length;
};
```

#### **Archivo 3: `mare-catalog-v2/src/lib/pdfGenerator.ts`** (NUEVO)

```typescript
import { jsPDF } from 'jspdf';
import { PedidoRecibido, PedidoRecibidoProducto } from './supabaseClient';

// ============================================
// GENERADOR DE PDF PROFESIONAL
// ============================================

export interface DatosPDF {
  pedido: PedidoRecibido;
  clienteNombre: string;
}

/**
 * Generar PDF de comprobante de pedido
 */
export const generarComprobantePDF = (datos: DatosPDF): jsPDF => {
  const doc = new jsPDF();
  const fecha = new Date(datos.pedido.fecha_pedido).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let y = margin;

  // ============================================
  // FUNCIÓN: Verificar espacio y agregar página
  // ============================================
  const checkPageBreak = (requiredSpace: number = 15) => {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ============================================
  // HEADER: Logo y título
  // ============================================
  doc.setFillColor(143, 106, 80); // Color #8F6A50
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Intentar cargar logo (si existe)
  try {
    // Logo se carga desde public/logo-mare.png
    // En producción esto funcionará si el logo está en /public
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('MARÉ', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('By Feraben SRL', pageWidth / 2, 28, { align: 'center' });
  } catch (e) {
    console.log('Logo no disponible, usando texto');
  }

  y = 50;

  // ============================================
  // TÍTULO: Comprobante de pedido
  // ============================================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('COMPROBANTE DE PEDIDO', pageWidth / 2, y, { align: 'center' });

  y += 15;

  // ============================================
  // INFORMACIÓN DEL PEDIDO
  // ============================================
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');

  // Línea 1: Número de pedido
  doc.setFont(undefined, 'bold');
  doc.text('Número de Pedido:', margin, y);
  doc.setFont(undefined, 'normal');
  doc.text(datos.pedido.numero, margin + 50, y);

  y += 7;

  // Línea 2: Fecha
  doc.setFont(undefined, 'bold');
  doc.text('Fecha:', margin, y);
  doc.setFont(undefined, 'normal');
  doc.text(fecha, margin + 50, y);

  y += 7;

  // Línea 3: Cliente
  doc.setFont(undefined, 'bold');
  doc.text('Cliente:', margin, y);
  doc.setFont(undefined, 'normal');
  doc.text(datos.clienteNombre, margin + 50, y);

  y += 15;

  // ============================================
  // LÍNEA SEPARADORA
  // ============================================
  doc.setDrawColor(143, 106, 80);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  // ============================================
  // DETALLE DE PRODUCTOS
  // ============================================
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('DETALLE DEL PEDIDO', margin, y);

  y += 10;

  // Headers de la tabla
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Código', margin, y);
  doc.text('Descripción', margin + 30, y);
  doc.text('Color/Variante', margin + 90, y);
  doc.text('Cant.', margin + 130, y);
  doc.text('Precio Unit.', margin + 145, y);
  doc.text('Subtotal', pageWidth - margin - 20, y, { align: 'right' });

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ============================================
  // ITEMS DEL PEDIDO
  // ============================================
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);

  let subtotalGeneral = 0;

  datos.pedido.productos.forEach((producto: PedidoRecibidoProducto, index: number) => {
    checkPageBreak(30);

    // Código del producto
    doc.setFont(undefined, 'bold');
    doc.text(producto.codigo, margin, y);

    // Nombre del producto (truncar si es muy largo)
    const nombreTruncado = producto.nombre.length > 35
      ? producto.nombre.substring(0, 35) + '...'
      : producto.nombre;
    doc.setFont(undefined, 'normal');
    doc.text(nombreTruncado, margin + 30, y);

    y += 5;

    // Variantes (colores)
    producto.variantes.forEach((variante) => {
      checkPageBreak(6);

      const subtotal = variante.cantidad * producto.precio_unitario;
      subtotalGeneral += subtotal;

      // Color
      doc.text(`  • ${variante.color}`, margin + 30, y);

      // Cantidad
      doc.text(variante.cantidad.toString(), margin + 133, y, { align: 'right' });

      // Precio unitario
      doc.text(`$${producto.precio_unitario.toLocaleString('es-AR')}`, margin + 168, y, { align: 'right' });

      // Subtotal
      doc.setFont(undefined, 'bold');
      doc.text(`$${subtotal.toLocaleString('es-AR')}`, pageWidth - margin, y, { align: 'right' });
      doc.setFont(undefined, 'normal');

      y += 5;
    });

    // Surtido (si existe)
    if (producto.surtido > 0) {
      checkPageBreak(6);

      const subtotalSurtido = producto.surtido * producto.precio_unitario;
      subtotalGeneral += subtotalSurtido;

      doc.text(`  • Surtido`, margin + 30, y);
      doc.text(producto.surtido.toString(), margin + 133, y, { align: 'right' });
      doc.text(`$${producto.precio_unitario.toLocaleString('es-AR')}`, margin + 168, y, { align: 'right' });
      doc.setFont(undefined, 'bold');
      doc.text(`$${subtotalSurtido.toLocaleString('es-AR')}`, pageWidth - margin, y, { align: 'right' });
      doc.setFont(undefined, 'normal');

      y += 5;
    }

    // Comentario del producto
    if (producto.comentario) {
      checkPageBreak(6);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text(`    💬 ${producto.comentario}`, margin + 30, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      y += 5;
    }

    // Espacio entre productos
    y += 3;
  });

  // ============================================
  // LÍNEA SEPARADORA FINAL
  // ============================================
  checkPageBreak(20);
  y += 5;
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================
  // COMENTARIO FINAL
  // ============================================
  if (datos.pedido.comentario_final) {
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Observaciones:', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);

    // Dividir texto largo en múltiples líneas
    const comentarioLineas = doc.splitTextToSize(
      datos.pedido.comentario_final,
      pageWidth - 2 * margin
    );

    comentarioLineas.forEach((linea: string) => {
      checkPageBreak(6);
      doc.text(linea, margin, y);
      y += 5;
    });

    y += 5;
  }

  // ============================================
  // TOTAL
  // ============================================
  checkPageBreak(15);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL:', pageWidth - margin - 60, y);
  doc.setTextColor(143, 106, 80);
  doc.text(
    `$${datos.pedido.total.toLocaleString('es-AR')}`,
    pageWidth - margin,
    y,
    { align: 'right' }
  );

  y += 15;

  // ============================================
  // FOOTER
  // ============================================
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont(undefined, 'normal');

  const footerY = pageHeight - 20;

  doc.text(
    'Este comprobante fue generado automáticamente por el sistema de catálogo web MARÉ',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  doc.text(
    `Feraben SRL • www.mareferaben.com • Pedido registrado en sistema ERP`,
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );

  doc.text(
    `Generado: ${new Date().toLocaleString('es-AR')}`,
    pageWidth / 2,
    footerY + 10,
    { align: 'center' }
  );

  return doc;
};

/**
 * Descargar PDF
 */
export const descargarPDF = (doc: jsPDF, numeroPedido: string): void => {
  const nombreArchivo = `Pedido_${numeroPedido}_${Date.now()}.pdf`;
  doc.save(nombreArchivo);
  console.log('📄 PDF descargado:', nombreArchivo);
};

/**
 * Compartir PDF (Web Share API - móviles)
 */
export const compartirPDF = async (doc: jsPDF, numeroPedido: string): Promise<boolean> => {
  try {
    const blob = doc.output('blob');
    const file = new File([blob], `Pedido_${numeroPedido}.pdf`, {
      type: 'application/pdf'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Pedido ${numeroPedido}`,
        text: `Comprobante de pedido MARÉ - ${numeroPedido}`
      });

      console.log('📤 PDF compartido exitosamente');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error compartiendo PDF:', error);
    return false;
  }
};
```

---

### **FASE 3: Catálogo - Modificar App.tsx**

**CAMBIOS REQUERIDOS EN `mare-catalog-v2/src/App.tsx`:**

1. **Imports nuevos (línea 1-4):**
```typescript
import { supabase, pedidosRecibidosService, PedidoRecibido, PedidoRecibidoProducto } from './lib/supabaseClient';
import {
  guardarPedidoOffline,
  iniciarMonitorConexion,
  hayInternet,
  cantidadPedidosPendientes
} from './lib/offlineSync';
import { generarComprobantePDF, descargarPDF, compartirPDF, DatosPDF } from './lib/pdfGenerator';
```

2. **Nueva función principal de envío (reemplaza handleWhatsAppSend):**
```typescript
/**
 * FUNCIÓN PRINCIPAL: Enviar Pedido Directo a Supabase
 * Con soporte offline automático
 */
const handleEnviarPedidoDirecto = async () => {
  setIsLoading(true);

  try {
    // ============================================
    // 1. VALIDACIONES
    // ============================================
    if (cart.length === 0) {
      alert('❌ El carrito está vacío');
      setIsLoading(false);
      return;
    }

    if (!loginData?.nombreCliente) {
      alert('❌ Error: No hay datos de cliente');
      setIsLoading(false);
      return;
    }

    // ============================================
    // 2. GENERAR NÚMERO DE PEDIDO
    // ============================================
    const timestamp = Date.now();
    const numeroPedido = `CAT-${timestamp.toString().slice(-6)}`;

    // ============================================
    // 3. CONSTRUIR ESTRUCTURA DE PRODUCTOS
    // ============================================
    const productos: PedidoRecibidoProducto[] = cart.map(item => ({
      codigo: item.producto.codigo,
      nombre: item.producto.nombre,
      precio_unitario: item.producto.precio,
      descripcion: item.producto.descripcion || '',
      categoria: item.producto.categoria || '',
      variantes: Object.entries(item.selecciones)
        .filter(([_, cantidad]) => cantidad > 0)
        .map(([color, cantidad]) => ({
          color,
          cantidad
        })),
      surtido: item.surtido || 0,
      comentario: item.comentario || ''
    }));

    // ============================================
    // 4. CONSTRUIR OBJETO PEDIDO COMPLETO
    // ============================================
    const pedido: PedidoRecibido = {
      numero: numeroPedido,
      cliente_nombre: loginData.nombreCliente,
      cliente_telefono: '',
      cliente_direccion: '',
      fecha_pedido: new Date().toISOString(),
      estado: 'recibido',
      origen: 'catalogo_web',
      productos: productos,
      comentario_final: comentarioFinal || '',
      total: getTotalPrice()
    };

    // ============================================
    // 5. GENERAR PDF (SIEMPRE, online u offline)
    // ============================================
    console.log('📄 Generando PDF...');
    const datosPDF: DatosPDF = {
      pedido,
      clienteNombre: loginData.nombreCliente
    };
    const pdf = generarComprobantePDF(datosPDF);

    // ============================================
    // 6. VERIFICAR CONEXIÓN Y ENVIAR
    // ============================================
    const tieneInternet = hayInternet();

    if (tieneInternet) {
      // ============================================
      // FLUJO ONLINE
      // ============================================
      console.log('🌐 Conexión detectada - Enviando a Supabase...');

      try {
        // Enviar a Supabase
        const resultado = await pedidosRecibidosService.insert(pedido);

        console.log('✅ Pedido enviado exitosamente:', resultado);

        // Descargar PDF
        descargarPDF(pdf, numeroPedido);

        // Intentar compartir en móviles
        await compartirPDF(pdf, numeroPedido);

        // Guardar último pedido para restaurar
        saveLastOrder();

        // Limpiar carrito
        onClearCart();
        onClose();

        // Notificar éxito
        alert(
          `✅ ¡Pedido enviado exitosamente!\n\n` +
          `📝 Número: ${numeroPedido}\n` +
          `💰 Total: $${pedido.total.toLocaleString()}\n` +
          `📦 Productos: ${cart.length}\n\n` +
          `Tu pedido fue registrado en el sistema ERP.\n` +
          `El PDF de comprobante se descargó automáticamente.`
        );

      } catch (error) {
        console.error('❌ Error enviando a Supabase:', error);

        // Si falla online, guardar offline
        console.log('📴 Guardando en cola offline...');
        guardarPedidoOffline(pedido);

        // Descargar PDF de todas formas
        descargarPDF(pdf, numeroPedido);

        // Guardar último pedido
        saveLastOrder();

        // Limpiar carrito
        onClearCart();
        onClose();

        // Notificar que se guardó offline
        alert(
          `⚠️ Error de conexión\n\n` +
          `📝 Número: ${numeroPedido}\n` +
          `💾 Tu pedido se guardó localmente y se enviará automáticamente cuando haya conexión.\n\n` +
          `El PDF de comprobante se descargó.`
        );
      }

    } else {
      // ============================================
      // FLUJO OFFLINE
      // ============================================
      console.log('📴 Sin conexión - Guardando offline...');

      // Guardar en localStorage
      guardarPedidoOffline(pedido);

      // Descargar PDF
      descargarPDF(pdf, numeroPedido);

      // Guardar último pedido
      saveLastOrder();

      // Limpiar carrito
      onClearCart();
      onClose();

      // Notificar
      alert(
        `📴 Sin conexión a internet\n\n` +
        `📝 Número: ${numeroPedido}\n` +
        `💾 Tu pedido se guardó localmente.\n\n` +
        `Se enviará automáticamente al sistema ERP cuando haya conexión.\n\n` +
        `El PDF de comprobante se descargó.`
      );
    }

  } catch (error) {
    console.error('💥 Error crítico:', error);
    alert(
      `❌ Error inesperado\n\n` +
      `Por favor intenta nuevamente o contacta a soporte.\n\n` +
      `Detalle: ${error instanceof Error ? error.message : 'Error desconocido'}`
    );
  } finally {
    setIsLoading(false);
  }
};
```

3. **Iniciar monitor de sincronización offline (línea ~1240):**
```typescript
// Iniciar monitor de sincronización offline
useEffect(() => {
  const cleanup = iniciarMonitorConexion();

  return () => {
    cleanup(); // Limpiar al desmontar
  };
}, []);
```

4. **Indicador de pedidos pendientes en header (línea ~1570):**
```typescript
{/* Indicador de pedidos pendientes offline */}
{cantidadPedidosPendientes() > 0 && (
  <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-300 rounded-lg">
    <span className="text-xs font-medium text-orange-800">
      ⏳ {cantidadPedidosPendientes()} pedido(s) pendiente(s)
    </span>
  </div>
)}
```

5. **Modificar modal del carrito - REEMPLAZAR botones (línea 1109-1142):**
```typescript
{/* BOTÓN PRINCIPAL: Envío Directo */}
<button
  onClick={handleEnviarPedidoDirecto}
  disabled={isLoading}
  className="w-full bg-green-600 text-white py-3 sm:py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
>
  <Send size={18} />
  {isLoading ? 'Enviando...' : '📤 Enviar Pedido'}
</button>

{/* Texto informativo */}
<div className="text-xs text-center text-gray-600 px-4">
  ✅ Registro automático en ERP • PDF de comprobante • Funciona sin internet
</div>

{/* BOTÓN SECUNDARIO: WhatsApp (Fallback temporal) */}
<details className="border rounded-lg p-2">
  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
    Opciones alternativas
  </summary>
  <div className="mt-2 space-y-2">
    <button
      onClick={handleWhatsAppSend}
      disabled={isLoading}
      className="w-full bg-gray-500 text-white py-2 rounded-lg text-sm hover:bg-gray-600"
    >
      <MessageCircle size={16} className="inline mr-2" />
      Enviar por WhatsApp (método anterior)
    </button>
  </div>
</details>
```

---

### **FASE 4: ERP - Nueva Sección "Pedidos Recibidos"**

#### **Archivo 1: `src/components/PedidosRecibidos/PedidosRecibidos.tsx`** (NUEVO)

```typescript
import React, { useState, useEffect } from 'react';
import {
  Package,
  Eye,
  CheckCircle,
  XCircle,
  Edit3,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import styles from './PedidosRecibidos.module.css';

// ============================================
// TIPOS
// ============================================
interface PedidoRecibidoVariante {
  color: string;
  cantidad: number;
}

interface PedidoRecibidoProducto {
  codigo: string;
  nombre: string;
  precio_unitario: number;
  descripcion: string;
  categoria: string;
  variantes: PedidoRecibidoVariante[];
  surtido: number;
  comentario: string;
}

interface PedidoRecibido {
  id: string;
  numero: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  fecha_pedido: string;
  estado: 'recibido' | 'revisando' | 'aprobado' | 'rechazado';
  origen: string;
  productos: PedidoRecibidoProducto[];
  comentario_final?: string;
  comentarios_admin?: string;
  total: number;
  created_at: string;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export const PedidosRecibidos: React.FC = () => {
  const [pedidos, setPedidos] = useState<PedidoRecibido[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoRecibido | null>(null);
  const [productosEditables, setProductosEditables] = useState<PedidoRecibidoProducto[]>([]);
  const [comentariosAdmin, setComentariosAdmin] = useState('');

  // ============================================
  // CARGAR PEDIDOS
  // ============================================
  const cargarPedidos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_recibidos')
        .select('*')
        .in('estado', ['recibido', 'revisando'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPedidos(data || []);
    } catch (error) {
      console.error('Error cargando pedidos recibidos:', error);
      alert('Error cargando pedidos recibidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();

    // Suscripción en tiempo real
    const subscription = supabase
      .channel('pedidos_recibidos_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos_recibidos'
      }, (payload) => {
        console.log('🔔 Cambio detectado en pedidos_recibidos:', payload);
        cargarPedidos();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // VER DETALLE
  // ============================================
  const verDetalle = (pedido: PedidoRecibido) => {
    setPedidoSeleccionado(pedido);
    setProductosEditables(JSON.parse(JSON.stringify(pedido.productos)));
    setComentariosAdmin(pedido.comentarios_admin || '');
  };

  // ============================================
  // EDITAR CANTIDAD DE VARIANTE
  // ============================================
  const editarCantidadVariante = (
    productoIndex: number,
    varianteIndex: number,
    nuevaCantidad: number
  ) => {
    const nuevosProductos = [...productosEditables];
    nuevosProductos[productoIndex].variantes[varianteIndex].cantidad = Math.max(0, nuevaCantidad);
    setProductosEditables(nuevosProductos);
  };

  // ============================================
  // ELIMINAR VARIANTE
  // ============================================
  const eliminarVariante = (productoIndex: number, varianteIndex: number) => {
    if (!confirm('¿Eliminar esta variante?')) return;

    const nuevosProductos = [...productosEditables];
    nuevosProductos[productoIndex].variantes.splice(varianteIndex, 1);

    // Si no quedan variantes ni surtido, eliminar producto completo
    if (
      nuevosProductos[productoIndex].variantes.length === 0 &&
      nuevosProductos[productoIndex].surtido === 0
    ) {
      nuevosProductos.splice(productoIndex, 1);
    }

    setProductosEditables(nuevosProductos);
  };

  // ============================================
  // EDITAR SURTIDO
  // ============================================
  const editarSurtido = (productoIndex: number, nuevoSurtido: number) => {
    const nuevosProductos = [...productosEditables];
    nuevosProductos[productoIndex].surtido = Math.max(0, nuevoSurtido);
    setProductosEditables(nuevosProductos);
  };

  // ============================================
  // ELIMINAR PRODUCTO
  // ============================================
  const eliminarProducto = (productoIndex: number) => {
    if (!confirm('¿Eliminar este producto completo del pedido?')) return;

    const nuevosProductos = [...productosEditables];
    nuevosProductos.splice(productoIndex, 1);
    setProductosEditables(nuevosProductos);
  };

  // ============================================
  // RECALCULAR TOTAL
  // ============================================
  const recalcularTotal = (): number => {
    return productosEditables.reduce((total, producto) => {
      const totalVariantes = producto.variantes.reduce(
        (sum, v) => sum + (v.cantidad * producto.precio_unitario),
        0
      );
      const totalSurtido = producto.surtido * producto.precio_unitario;
      return total + totalVariantes + totalSurtido;
    }, 0);
  };

  // ============================================
  // APROBAR PEDIDO
  // ============================================
  const aprobarPedido = async () => {
    if (!pedidoSeleccionado) return;

    if (productosEditables.length === 0) {
      alert('❌ El pedido no tiene productos. Agrégalos o rechaza el pedido.');
      return;
    }

    const confirmacion = confirm(
      `¿Aprobar y enviar a Depósito?\n\n` +
      `Pedido: ${pedidoSeleccionado.numero}\n` +
      `Cliente: ${pedidoSeleccionado.cliente_nombre}\n` +
      `Total: $${recalcularTotal().toLocaleString()}\n` +
      `Productos: ${productosEditables.length}`
    );

    if (!confirmacion) return;

    setLoading(true);

    try {
      // Llamar a función de Supabase que hace la transacción
      const { data, error } = await supabase.rpc('aprobar_pedido_recibido', {
        p_pedido_recibido_id: pedidoSeleccionado.id,
        p_usuario_aprobador: 'admin' // TODO: obtener de sesión
      });

      if (error) throw error;

      alert(`✅ Pedido aprobado y enviado a Depósito\n\nNúmero: ${pedidoSeleccionado.numero}`);

      // Cerrar detalle y recargar
      setPedidoSeleccionado(null);
      cargarPedidos();

    } catch (error) {
      console.error('Error aprobando pedido:', error);
      alert(`❌ Error al aprobar pedido:\n\n${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RECHAZAR PEDIDO
  // ============================================
  const rechazarPedido = async () => {
    if (!pedidoSeleccionado) return;

    const motivo = prompt('¿Por qué se rechaza este pedido?');
    if (!motivo) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('pedidos_recibidos')
        .update({
          estado: 'rechazado',
          comentarios_admin: `RECHAZADO: ${motivo}`
        })
        .eq('id', pedidoSeleccionado.id);

      if (error) throw error;

      alert(`✅ Pedido rechazado\n\nMotivo: ${motivo}`);

      setPedidoSeleccionado(null);
      cargarPedidos();

    } catch (error) {
      console.error('Error rechazando pedido:', error);
      alert('❌ Error al rechazar pedido');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER: VISTA LISTA
  // ============================================
  if (!pedidoSeleccionado) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Package size={32} />
            <div>
              <h1>Pedidos Recibidos</h1>
              <p>Revisa y aprueba pedidos antes de enviar a Depósito</p>
            </div>
          </div>

          <button onClick={cargarPedidos} className={styles.btnRefresh} disabled={loading}>
            <RefreshCw size={20} className={loading ? styles.spinning : ''} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <RefreshCw size={48} className={styles.spinning} />
            <p>Cargando pedidos...</p>
          </div>
        ) : pedidos.length === 0 ? (
          <div className={styles.empty}>
            <Package size={64} />
            <h2>No hay pedidos pendientes de revisión</h2>
            <p>Los nuevos pedidos del catálogo aparecerán aquí</p>
          </div>
        ) : (
          <div className={styles.lista}>
            {pedidos.map((pedido) => (
              <div key={pedido.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>{pedido.numero}</h3>
                    <p className={styles.cliente}>{pedido.cliente_nombre}</p>
                  </div>
                  <span className={`${styles.badge} ${styles[pedido.estado]}`}>
                    {pedido.estado}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.info}>
                    <span>📅 {new Date(pedido.fecha_pedido).toLocaleString('es-AR')}</span>
                    <span>📦 {pedido.productos.length} producto(s)</span>
                    <span>💰 ${pedido.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button onClick={() => verDetalle(pedido)} className={styles.btnPrimary}>
                    <Eye size={16} />
                    Ver Detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: VISTA DETALLE
  // ============================================
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setPedidoSeleccionado(null)} className={styles.btnBack}>
          <ArrowLeft size={20} />
          Volver
        </button>

        <div className={styles.headerContent}>
          <h1>Pedido {pedidoSeleccionado.numero}</h1>
        </div>
      </div>

      <div className={styles.detalle}>
        {/* INFO DEL CLIENTE */}
        <div className={styles.section}>
          <h2>Información del Cliente</h2>
          <div className={styles.grid}>
            <div>
              <label>Cliente:</label>
              <p>{pedidoSeleccionado.cliente_nombre}</p>
            </div>
            <div>
              <label>Fecha:</label>
              <p>{new Date(pedidoSeleccionado.fecha_pedido).toLocaleString('es-AR')}</p>
            </div>
          </div>
        </div>

        {/* PRODUCTOS */}
        <div className={styles.section}>
          <h2>Productos</h2>

          {productosEditables.map((producto, pIndex) => (
            <div key={pIndex} className={styles.productoCard}>
              <div className={styles.productoHeader}>
                <div>
                  <h3>{producto.codigo} - {producto.nombre}</h3>
                  <p>${producto.precio_unitario.toLocaleString()} c/u</p>
                </div>
                <button
                  onClick={() => eliminarProducto(pIndex)}
                  className={styles.btnDelete}
                  title="Eliminar producto"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Variantes */}
              <div className={styles.variantes}>
                {producto.variantes.map((variante, vIndex) => (
                  <div key={vIndex} className={styles.variante}>
                    <span className={styles.varianteColor}>{variante.color}</span>

                    <div className={styles.cantidadControl}>
                      <button
                        onClick={() => editarCantidadVariante(pIndex, vIndex, variante.cantidad - 1)}
                      >
                        <Minus size={14} />
                      </button>

                      <input
                        type="number"
                        value={variante.cantidad}
                        onChange={(e) => editarCantidadVariante(
                          pIndex,
                          vIndex,
                          parseInt(e.target.value) || 0
                        )}
                        min="0"
                      />

                      <button
                        onClick={() => editarCantidadVariante(pIndex, vIndex, variante.cantidad + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => eliminarVariante(pIndex, vIndex)}
                      className={styles.btnDeleteSmall}
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Surtido */}
              {producto.surtido > 0 && (
                <div className={styles.surtido}>
                  <span>Surtido:</span>
                  <div className={styles.cantidadControl}>
                    <button onClick={() => editarSurtido(pIndex, producto.surtido - 1)}>
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      value={producto.surtido}
                      onChange={(e) => editarSurtido(pIndex, parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <button onClick={() => editarSurtido(pIndex, producto.surtido + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Comentario del producto */}
              {producto.comentario && (
                <div className={styles.comentario}>
                  💬 {producto.comentario}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* COMENTARIO FINAL */}
        {pedidoSeleccionado.comentario_final && (
          <div className={styles.section}>
            <h2>Comentario del Cliente</h2>
            <p>{pedidoSeleccionado.comentario_final}</p>
          </div>
        )}

        {/* COMENTARIOS ADMIN */}
        <div className={styles.section}>
          <h2>Comentarios Administrativos</h2>
          <textarea
            value={comentariosAdmin}
            onChange={(e) => setComentariosAdmin(e.target.value)}
            placeholder="Agregar notas internas..."
            rows={3}
          />
        </div>

        {/* TOTAL */}
        <div className={styles.total}>
          <span>TOTAL:</span>
          <span>${recalcularTotal().toLocaleString()}</span>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className={styles.acciones}>
          <button onClick={rechazarPedido} className={styles.btnRechazar} disabled={loading}>
            <XCircle size={20} />
            Rechazar Pedido
          </button>

          <button onClick={aprobarPedido} className={styles.btnAprobar} disabled={loading}>
            <CheckCircle size={20} />
            ✅ Aprobar y Enviar a Depósito
          </button>
        </div>
      </div>
    </div>
  );
};

export default PedidosRecibidos;
```

#### **Archivo 2: `src/components/PedidosRecibidos/PedidosRecibidos.module.css`** (NUEVO)

```css
/* ============================================
   PEDIDOS RECIBIDOS - ESTILOS
   ============================================ */

.container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.headerContent {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.headerContent h1 {
  margin: 0;
  font-size: 2rem;
  color: #8F6A50;
}

.headerContent p {
  margin: 0.5rem 0 0 0;
  color: #6b7280;
}

.btnRefresh,
.btnBack {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: #8F6A50;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btnRefresh:hover,
.btnBack:hover {
  background-color: #7a5a43;
  transform: translateY(-1px);
}

.btnRefresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================
   LOADING Y EMPTY
   ============================================ */

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #6b7280;
}

.loading svg {
  color: #8F6A50;
  margin-bottom: 1rem;
}

.empty svg {
  color: #d1d5db;
  margin-bottom: 1rem;
}

.empty h2 {
  margin: 1rem 0 0.5rem 0;
  color: #374151;
}

/* ============================================
   LISTA DE PEDIDOS
   ============================================ */

.lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.2s;
}

.card:hover {
  border-color: #8F6A50;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.cardHeader h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #8F6A50;
}

.cliente {
  margin: 0.25rem 0 0 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge.recibido {
  background-color: #dbeafe;
  color: #1e40af;
}

.badge.revisando {
  background-color: #fef3c7;
  color: #92400e;
}

.cardBody {
  margin-bottom: 1rem;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.cardFooter {
  display: flex;
  gap: 0.5rem;
}

.btnPrimary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background-color: #8F6A50;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btnPrimary:hover {
  background-color: #7a5a43;
}

/* ============================================
   VISTA DETALLE
   ============================================ */

.detalle {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  border: 1px solid #e5e7eb;
}

.section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.section:last-of-type {
  border-bottom: none;
}

.section h2 {
  margin: 0 0 1rem 0;
  color: #8F6A50;
  font-size: 1.25rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.grid label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.grid p {
  margin: 0;
  color: #6b7280;
}

/* ============================================
   PRODUCTOS EDITABLES
   ============================================ */

.productoCard {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.productoHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.productoHeader h3 {
  margin: 0;
  font-size: 1rem;
  color: #374151;
}

.productoHeader p {
  margin: 0.25rem 0 0 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.btnDelete,
.btnDeleteSmall {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.btnDelete:hover,
.btnDeleteSmall:hover {
  background-color: #fee2e2;
}

/* Variantes */
.variantes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.variante {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}

.varianteColor {
  flex: 1;
  font-weight: 500;
  color: #374151;
}

.cantidadControl {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cantidadControl button {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #8F6A50;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cantidadControl button:hover {
  background-color: #7a5a43;
}

.cantidadControl input {
  width: 4rem;
  text-align: center;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-weight: 600;
}

.surtido {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 0.375rem;
  margin-top: 0.75rem;
}

.surtido span:first-child {
  font-weight: 600;
  color: #92400e;
}

.comentario {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-left: 3px solid #8F6A50;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Textarea */
.section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-family: inherit;
  resize: vertical;
}

/* ============================================
   TOTAL Y ACCIONES
   ============================================ */

.total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f9fafb;
  border: 2px solid #8F6A50;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #8F6A50;
}

.acciones {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btnRechazar,
.btnAprobar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btnRechazar {
  background-color: #ef4444;
  color: white;
}

.btnRechazar:hover {
  background-color: #dc2626;
}

.btnAprobar {
  background-color: #22c55e;
  color: white;
}

.btnAprobar:hover {
  background-color: #16a34a;
}

.btnRechazar:disabled,
.btnAprobar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .lista {
    grid-template-columns: 1fr;
  }

  .acciones {
    flex-direction: column;
  }

  .btnRechazar,
  .btnAprobar {
    width: 100%;
  }
}
```

---

## ✅ RESUMEN: QUÉ SE HACE EN CADA FASE

### **FASE 1: Base de Datos** ✅
- Crear tabla `pedidos_recibidos` en Supabase
- Crear función `aprobar_pedido_recibido()` que hace la transacción
- Configurar RLS policies
- Testing: Insertar pedido de prueba manualmente

### **FASE 2: Catálogo - Archivos Nuevos** ✅
- `lib/supabaseClient.ts` → Cliente Supabase
- `lib/offlineSync.ts` → Cola de sincronización
- `lib/pdfGenerator.ts` → Generador de PDF
- `.env` → Variables de entorno con credenciales

### **FASE 3: Catálogo - Modificar App.tsx** ✅
- Importar librerías nuevas
- Crear función `handleEnviarPedidoDirecto()`
- Reemplazar botones del modal
- Agregar monitor de sincronización
- Agregar indicador de pedidos pendientes

### **FASE 4: ERP - Nueva Sección** ✅
- `components/PedidosRecibidos/PedidosRecibidos.tsx`
- `components/PedidosRecibidos/PedidosRecibidos.module.css`
- Modificar `DashboardSupabase.tsx` para agregar link
- Modificar rutas si es necesario

---

## 🧪 PLAN DE TESTING {#testing}

### **Test 1: Conexión Supabase desde Catálogo**
```typescript
// En consola del navegador (catálogo)
import { pedidosRecibidosService } from './lib/supabaseClient';
await pedidosRecibidosService.testConnection(); // → debe retornar true
```

### **Test 2: Envío Online**
1. Agregar productos al carrito
2. Click "Enviar Pedido"
3. Verificar que se descarga PDF
4. Verificar que se inserta en Supabase
5. Verificar que aparece en ERP sección "Pedidos Recibidos"

### **Test 3: Envío Offline**
1. Desconectar internet
2. Agregar productos y enviar
3. Verificar mensaje "guardado offline"
4. Verificar PDF descargado
5. Reconectar internet
6. Esperar 30 segundos
7. Verificar que se sincronizó en Supabase

### **Test 4: Edición en ERP**
1. Ver pedido en "Pedidos Recibidos"
2. Editar cantidades
3. Eliminar variante
4. Agregar comentario admin
5. Aprobar y enviar a depósito
6. Verificar que aparece en sección "Pedidos" normal

### **Test 5: Flujo Completo hasta Facturación**
1. Enviar pedido desde catálogo
2. Aprobar en "Pedidos Recibidos"
3. Preparar en "Pedidos" (depósito)
4. Completar pedido
5. Ir a "Facturación"
6. Generar Excel
7. Verificar formato idéntico al actual

---

## 🔄 ROLLBACK Y CONTINGENCIAS {#rollback}

### **Si algo sale mal:**

1. **Base de datos Supabase:**
   - Hacer backup antes de empezar
   - Si falla, ejecutar `DROP TABLE pedidos_recibidos CASCADE;`
   - Sistema actual sigue funcionando

2. **Catálogo:**
   - Git: `git checkout .` para volver atrás
   - Los archivos nuevos no afectan lo existente
   - WhatsApp sigue disponible como fallback

3. **ERP:**
   - Comentar ruta a PedidosRecibidos
   - Sistema actual no se toca

### **Estrategia de Deploy:**

```
1. Localhost → Testing completo (2-3 días)
2. Vercel preview → Testing con equipo (1 día)
3. Producción → Deploy gradual
```

---

## 📞 CONTACTO Y SOPORTE

- **Desarrollador:** Claude Code (Anthropic)
- **Cliente:** Feraben SRL
- **Repositorio:** `C:\Users\Usuario\ERP-ferabensrl-claude`
- **Catálogo:** `C:\Users\Usuario\mare-catalog-v2`

---

## ✅ CHECKLIST PRE-IMPLEMENTACIÓN

Antes de comenzar, verificar:

- [ ] Credenciales Supabase disponibles
- [ ] Backup de ambos proyectos realizado
- [ ] Git commits recientes
- [ ] Node.js y npm actualizados
- [ ] Dependencias instaladas en ambos proyectos
- [ ] Plan de testing definido
- [ ] Tiempo estimado: 1-2 semanas de desarrollo + testing

---

**FIN DEL DOCUMENTO**

Este plan está listo para ejecutarse. Todas las decisiones críticas están documentadas y cada paso está explicado quirúrgicamente. ¿Luz verde para comenzar?
