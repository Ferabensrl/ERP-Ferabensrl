# 🔒 POLÍTICAS DE SEGURIDAD SUPABASE - NOTIFICACIONES

## ⚠️ PROBLEMA IDENTIFICADO

**Fecha:** 23 de Octubre de 2025

**Error al enviar pedido desde catálogo:**
```
Error de Supabase: new row violates row-level security policy table "notificaciones_pendientes"
```

**Causa:** La tabla `notificaciones_pendientes` tenía RLS (Row Level Security) activado pero **sin políticas configuradas**, por lo que ningún usuario (ni anon ni authenticated) podía insertar registros.

---

## ✅ SOLUCIÓN APLICADA

Se crearon **3 políticas de seguridad** en la tabla `notificaciones_pendientes` para permitir las operaciones necesarias:

### **SQL Ejecutado:**

```sql
-- Permitir que el trigger inserte notificaciones
CREATE POLICY "Sistema puede crear notificaciones"
ON notificaciones_pendientes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir leer notificaciones
CREATE POLICY "Sistema puede leer notificaciones"
ON notificaciones_pendientes
FOR SELECT
TO anon, authenticated
USING (true);

-- Permitir actualizar notificaciones (para marcar como enviadas)
CREATE POLICY "Sistema puede actualizar notificaciones"
ON notificaciones_pendientes
FOR UPDATE
TO anon, authenticated
USING (true);
```

---

## 🔐 EXPLICACIÓN DE LAS POLÍTICAS

### **1. Política de INSERT (Crear notificaciones)**
```sql
CREATE POLICY "Sistema puede crear notificaciones"
ON notificaciones_pendientes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

**¿Qué hace?**
- Permite que tanto usuarios **anónimos (anon)** como **autenticados (authenticated)** inserten notificaciones
- `WITH CHECK (true)` significa: "permitir siempre, sin condiciones"

**¿Por qué es necesaria?**
- El **trigger de Supabase** (`notificar_nuevo_pedido`) se ejecuta cuando el catálogo inserta un pedido
- El catálogo usa la clave `anon` (usuario anónimo)
- El trigger necesita insertar en `notificaciones_pendientes`

---

### **2. Política de SELECT (Leer notificaciones)**
```sql
CREATE POLICY "Sistema puede leer notificaciones"
ON notificaciones_pendientes
FOR SELECT
TO anon, authenticated
USING (true);
```

**¿Qué hace?**
- Permite leer todas las notificaciones sin restricciones

**¿Por qué es necesaria?**
- **Make.com** necesita leer las notificaciones pendientes
- La función RPC `obtener_notificaciones_pendientes()` necesita hacer SELECT
- Make.com usa las credenciales de Supabase (service_role en realidad, pero esta política cubre todos los casos)

---

### **3. Política de UPDATE (Actualizar notificaciones)**
```sql
CREATE POLICY "Sistema puede actualizar notificaciones"
ON notificaciones_pendientes
FOR UPDATE
TO anon, authenticated
USING (true);
```

**¿Qué hace?**
- Permite actualizar cualquier notificación

**¿Por qué es necesaria?**
- **Make.com** necesita marcar las notificaciones como "enviadas" después de enviar el email
- La función RPC `marcar_notificacion_enviada()` hace UPDATE
- También se usa para marcar errores con `marcar_notificacion_error()`

---

## 📊 ESTRUCTURA COMPLETA DE RLS

### **Tabla: pedidos_recibidos**

```sql
-- Permitir INSERT desde el catálogo (usuarios anónimos)
CREATE POLICY "Catalogo puede insertar pedidos"
ON pedidos_recibidos
FOR INSERT
TO anon
WITH CHECK (origen = 'catalogo_web');

-- Permitir SELECT a usuarios autenticados del ERP
CREATE POLICY "ERP puede leer pedidos"
ON pedidos_recibidos
FOR SELECT
TO authenticated, anon
USING (true);

-- Permitir UPDATE a usuarios autenticados del ERP
CREATE POLICY "ERP puede actualizar pedidos"
ON pedidos_recibidos
FOR UPDATE
TO authenticated
USING (true);
```

### **Tabla: notificaciones_pendientes**

```sql
-- Permitir INSERT (trigger + sistema)
CREATE POLICY "Sistema puede crear notificaciones"
ON notificaciones_pendientes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir SELECT (Make.com + ERP)
CREATE POLICY "Sistema puede leer notificaciones"
ON notificaciones_pendientes
FOR SELECT
TO anon, authenticated
USING (true);

-- Permitir UPDATE (Make.com marca como enviadas)
CREATE POLICY "Sistema puede actualizar notificaciones"
ON notificaciones_pendientes
FOR UPDATE
TO anon, authenticated
USING (true);
```

---

## 🔍 VERIFICAR POLÍTICAS ACTUALES

Para ver todas las políticas configuradas en Supabase:

```sql
-- Ver políticas de pedidos_recibidos
SELECT * FROM pg_policies WHERE tablename = 'pedidos_recibidos';

-- Ver políticas de notificaciones_pendientes
SELECT * FROM pg_policies WHERE tablename = 'notificaciones_pendientes';
```

---

## 🚨 TROUBLESHOOTING

### **Error: "new row violates row-level security policy"**

**Causas posibles:**
1. RLS está activado pero no hay políticas
2. Las políticas no permiten la operación (INSERT/SELECT/UPDATE)
3. El usuario (anon/authenticated) no está incluido en la política

**Solución rápida (temporal):**
```sql
-- Desactivar RLS temporalmente
ALTER TABLE notificaciones_pendientes DISABLE ROW LEVEL SECURITY;
```

**Solución correcta (segura):**
- Crear las políticas adecuadas (ver arriba)
- Mantener RLS activado para seguridad

---

### **Error: "permission denied for table"**

Significa que no hay política de SELECT/UPDATE/DELETE.

**Solución:**
```sql
-- Agregar política faltante
CREATE POLICY "Nombre descriptivo"
ON nombre_tabla
FOR [SELECT|INSERT|UPDATE|DELETE]
TO anon, authenticated
USING (true);  -- o WITH CHECK (true) para INSERT
```

---

## 🔐 MEJORES PRÁCTICAS DE SEGURIDAD

### **1. Usar WITH CHECK más restrictivos**

En lugar de `WITH CHECK (true)`, podrías restringir:

```sql
-- Solo permitir notificaciones de tipo email
CREATE POLICY "Sistema puede crear notificaciones email"
ON notificaciones_pendientes
FOR INSERT
TO anon, authenticated
WITH CHECK (tipo = 'email');
```

### **2. Separar políticas por usuario**

```sql
-- Solo anon puede insertar (trigger)
CREATE POLICY "Trigger puede crear notificaciones"
ON notificaciones_pendientes
FOR INSERT
TO anon
WITH CHECK (true);

-- Solo authenticated puede actualizar (ERP/Make.com)
CREATE POLICY "Sistema puede actualizar notificaciones"
ON notificaciones_pendientes
FOR UPDATE
TO authenticated
USING (true);
```

### **3. Restringir por estado**

```sql
-- Solo permitir actualizar notificaciones pendientes
CREATE POLICY "Solo actualizar pendientes"
ON notificaciones_pendientes
FOR UPDATE
TO authenticated
USING (estado = 'pendiente');
```

---

## 📝 COMANDOS ÚTILES

### **Ver todas las tablas con RLS activado:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

### **Eliminar una política:**
```sql
DROP POLICY "nombre_de_la_politica" ON nombre_tabla;
```

### **Desactivar RLS en una tabla:**
```sql
ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;
```

### **Reactivar RLS en una tabla:**
```sql
ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;
```

---

## ✅ ESTADO FINAL

**Tablas con RLS:**
- ✅ `pedidos_recibidos` - RLS ACTIVO con 3 políticas
- ✅ `notificaciones_pendientes` - RLS ACTIVO con 3 políticas

**Operaciones permitidas:**
- ✅ Catálogo puede insertar pedidos
- ✅ Trigger puede crear notificaciones
- ✅ Make.com puede leer y actualizar notificaciones
- ✅ ERP puede leer y actualizar pedidos

**Sistema funcionando correctamente:**
- ✅ Pedidos se insertan desde el catálogo
- ✅ Trigger crea notificaciones automáticamente
- ✅ Make.com envía emails cada 5 minutos
- ✅ Email de prueba recibido exitosamente

---

## 🔮 SI SURGE UN PROBLEMA EN EL FUTURO

### **Síntoma: No se pueden insertar pedidos desde el catálogo**

**Verificar:**
```sql
-- Ver políticas de pedidos_recibidos
SELECT * FROM pg_policies WHERE tablename = 'pedidos_recibidos';
```

**Debe tener al menos:**
- Política INSERT para `anon`

### **Síntoma: No se crean notificaciones**

**Verificar:**
```sql
-- Ver políticas de notificaciones_pendientes
SELECT * FROM pg_policies WHERE tablename = 'notificaciones_pendientes';
```

**Debe tener:**
- Política INSERT para `anon, authenticated`

### **Síntoma: Make.com no puede leer notificaciones**

**Verificar:**
```sql
-- Verificar servicio_role en Make.com
-- La service_role key bypasea RLS, pero si se usa anon key, necesita política SELECT
```

**Solución:**
- Asegurarse de usar **service_role key** en Make.com (recomendado)
- O agregar política SELECT para anon

---

## 📞 INFORMACIÓN DE CONTACTO

**Sistema desarrollado por:** Claude Code
**Cliente:** Feraben SRL
**Fecha de configuración:** 23 de Octubre de 2025
**Estado:** ✅ FUNCIONANDO

---

## 🎯 RESUMEN EJECUTIVO

**El problema se resolvió agregando 3 políticas RLS a la tabla `notificaciones_pendientes`:**

1. INSERT - Para que el trigger pueda crear notificaciones
2. SELECT - Para que Make.com pueda leer notificaciones
3. UPDATE - Para que Make.com pueda marcarlas como enviadas

**Todo está funcionando correctamente ahora.** ✅
