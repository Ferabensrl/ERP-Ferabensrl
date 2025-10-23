# 📧 GUÍA COMPLETA: NOTIFICACIONES POR EMAIL

## 🎯 OBJETIVO

Recibir un email automático a `ventas@mareuy.com` cada vez que llegue un nuevo pedido desde el catálogo MARÉ.

---

## 📋 OPCIONES DISPONIBLES

He preparado **3 opciones** ordenadas de más fácil a más compleja:

### ✅ **OPCIÓN 1: Make.com / Zapier** (RECOMENDADA - LA MÁS FÁCIL)
- ⏱️ Configuración: 10-15 minutos
- 💰 Costo: **GRATIS** (hasta 1,000 operaciones/mes en Make.com)
- 🎯 Dificultad: **FÁCIL** (sin programación)
- ✅ Ideal para: Usuarios sin conocimientos técnicos

### ✅ **OPCIÓN 2: Script Node.js Automático**
- ⏱️ Configuración: 20-30 minutos
- 💰 Costo: **GRATIS**
- 🎯 Dificultad: **MEDIA** (requiere configurar Gmail/SMTP)
- ✅ Ideal para: Si tienes un servidor o computadora siempre encendida

### ✅ **OPCIÓN 3: Supabase Edge Function**
- ⏱️ Configuración: 30-45 minutos
- 💰 Costo: **GRATIS** (incluido en Supabase)
- 🎯 Dificultad: **AVANZADA** (requiere conocimientos de Supabase)
- ✅ Ideal para: Máxima confiabilidad y escalabilidad

---

## 🚀 PASO 1: PREPARAR LA BASE DE DATOS

### 1.1. Ejecutar el script SQL en Supabase

1. Ir a Supabase Dashboard: https://supabase.com/dashboard
2. Seleccionar tu proyecto
3. Ir a **SQL Editor** (en el menú izquierdo)
4. Abrir el archivo `supabase-trigger-notificacion-email.sql`
5. Copiar TODO el contenido
6. Pegarlo en el SQL Editor
7. **IMPORTANTE**: Antes de ejecutar, editar estas líneas:

```sql
-- Línea 41: Cambiar el email de destino
'ventas@mareuy.com', -- 📧 CAMBIAR ESTE EMAIL POR EL TUYO

-- Línea 51: Cambiar la URL del ERP
'https://tu-erp.com/pedidos-recibidos', -- Cambiar por tu URL real
```

8. Hacer clic en **RUN** (o presionar Ctrl+Enter)
9. Verificar que aparezca: "Success. No rows returned"

### 1.2. Verificar que se creó correctamente

Ejecutar esta consulta en el SQL Editor:

```sql
SELECT * FROM notificaciones_pendientes LIMIT 1;
```

Debería aparecer una tabla vacía (sin errores).

---

## ⭐ OPCIÓN 1: CONFIGURAR CON MAKE.COM (RECOMENDADO)

### ✅ Ventajas:
- No requiere programación
- Interfaz visual (drag & drop)
- Gratis hasta 1,000 operaciones/mes
- Integración directa con Gmail, Outlook, etc.
- Confiable y fácil de mantener

### 📝 Paso a paso:

#### 1. Crear cuenta en Make.com

1. Ir a: https://www.make.com/en/register
2. Registrarse con tu email
3. Verificar el email
4. Elegir el plan **Free** (gratuito)

#### 2. Crear un nuevo escenario

1. Hacer clic en **"Create a new scenario"**
2. Buscar "Schedule" y agregarlo como primer módulo
3. Configurar:
   - **Interval**: 5 minutos
   - Esto hará que el escenario se ejecute cada 5 minutos

#### 3. Agregar conexión con Supabase

1. Hacer clic en el **+** después del Schedule
2. Buscar "Supabase" y seleccionar **"Make an API Call"**
3. Conectar tu cuenta de Supabase:
   - **URL**: `https://cedspllucwvpoehlyccs.supabase.co`
   - **API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZHNwbGx1Y3d2cG9laGx5Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjkyMTQsImV4cCI6MjA2ODIwNTIxNH0.80z7k6ti2pxBKb8x6NILe--YNaLhJemtC32oqKW-Kz4`

4. Configurar la llamada:
   - **Method**: POST
   - **URL**: `/rest/v1/rpc/obtener_notificaciones_pendientes`
   - **Headers**:
     ```
     Content-Type: application/json
     Prefer: return=representation
     ```

#### 4. Agregar filtro para verificar si hay notificaciones

1. Hacer clic en el **icono de llave inglesa** entre Supabase y el siguiente paso
2. Agregar condición:
   - **Label**: "Hay notificaciones"
   - **Condition**: `{{length(1.data)}}` greater than `0`

#### 5. Agregar iterador para procesar cada notificación

1. Agregar módulo **"Iterator"**
2. Configurar:
   - **Array**: `{{1.data}}` (los datos de Supabase)

#### 6. Enviar email con Gmail/Outlook

**Para Gmail:**

1. Agregar módulo "Gmail" > "Send an Email"
2. Conectar tu cuenta de Gmail
3. Configurar:
   - **To**: `{{5.destinatario}}`
   - **Subject**: `{{5.asunto}}`
   - **Content Type**: HTML
   - **Text Content**:
   ```html
   <h2>🛒 Nuevo Pedido Recibido</h2>
   <p><strong>Número:</strong> {{5.pedido_numero}}</p>
   <p><strong>Cliente:</strong> {{5.pedido_cliente}}</p>
   <p><strong>Total:</strong> ${{5.pedido_total}}</p>
   <br>
   <a href="http://localhost:5173/pedidos-recibidos">Ver en ERP</a>
   ```

**Para Outlook:**

1. Agregar módulo "Microsoft 365 Email" > "Send an Email"
2. Conectar tu cuenta de Microsoft
3. Configurar igual que Gmail

#### 7. Marcar notificación como enviada

1. Agregar otro módulo de Supabase > "Make an API Call"
2. Configurar:
   - **Method**: POST
   - **URL**: `/rest/v1/rpc/marcar_notificacion_enviada`
   - **Body**:
   ```json
   {
     "notificacion_id": "{{5.id}}"
   }
   ```

#### 8. Activar el escenario

1. Hacer clic en el **switch ON/OFF** en la esquina inferior izquierda
2. Hacer clic en **"Run once"** para probar
3. Verificar que funcione correctamente

### 🧪 Probar:

1. Crear un pedido de prueba desde el catálogo
2. Esperar 5 minutos (o ejecutar manualmente el escenario)
3. Verificar que llegue el email

---

## 🔧 OPCIÓN 2: SCRIPT NODE.JS AUTOMÁTICO

### ✅ Ventajas:
- Control total del código
- Gratis (usa tu propio SMTP)
- Flexible y personalizable
- No depende de servicios externos

### 📝 Paso a paso:

#### 1. Instalar dependencias

Abrir terminal en la carpeta del proyecto y ejecutar:

```bash
npm install @supabase/supabase-js nodemailer
```

#### 2. Configurar el script

1. Abrir el archivo `notificador-email.js`
2. Editar estas líneas:

```javascript
// Línea 20-26: Configurar tu email SMTP
const EMAIL_CONFIG = {
  host: 'smtp.gmail.com', // smtp.outlook.com para Outlook
  port: 587,
  secure: false,
  auth: {
    user: 'tu-email@gmail.com', // 📧 CAMBIAR
    pass: 'tu-contraseña-app'    // 📧 CAMBIAR (ver instrucciones abajo)
  }
};

// Línea 29: Email de destino
const EMAIL_DESTINO = 'ventas@mareuy.com'; // 📧 CAMBIAR
```

#### 3. Configurar Gmail para enviar emails

**Gmail requiere una "Contraseña de aplicación":**

1. Ir a: https://myaccount.google.com/security
2. Activar **"Verificación en 2 pasos"**
3. Buscar **"Contraseñas de aplicaciones"**
4. Crear una nueva:
   - Nombre: "ERP Feraben Notificaciones"
   - Copiar la contraseña de 16 caracteres
5. Usar esa contraseña en `EMAIL_CONFIG.auth.pass`

**Para Outlook/Hotmail:**

```javascript
const EMAIL_CONFIG = {
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tu-email@outlook.com',
    pass: 'tu-contraseña-normal' // Outlook usa la contraseña normal
  }
};
```

#### 4. Probar el script manualmente

```bash
node notificador-email.js
```

Debería aparecer:

```
╔═══════════════════════════════════════════╗
║   NOTIFICADOR DE EMAILS - ERP FERABEN    ║
╚═══════════════════════════════════════════╝

🔧 Verificando configuración...

✅ Conexión a Supabase: OK
✅ Configuración de email: OK

✅ Todo configurado correctamente

[23/10/2025 14:30:45] 🔍 Buscando notificaciones pendientes...
✅ No hay notificaciones pendientes

✅ Proceso completado
```

#### 5. Ejecutar automáticamente cada 5 minutos

**OPCIÓN A: Con PM2 (Recomendado - Linux/Mac/Windows)**

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Ejecutar el script cada 5 minutos
pm2 start notificador-email.js --cron "*/5 * * * *" --name "erp-notificaciones"

# Ver logs en tiempo real
pm2 logs erp-notificaciones

# Detener
pm2 stop erp-notificaciones

# Hacer que PM2 se inicie automáticamente al reiniciar
pm2 startup
pm2 save
```

**OPCIÓN B: Programador de tareas de Windows**

1. Abrir "Programador de tareas"
2. Crear tarea básica > Nombre: "ERP Notificaciones"
3. Desencadenador: Diariamente, repetir cada 5 minutos
4. Acción: Iniciar programa
   - **Programa**: `C:\Program Files\nodejs\node.exe`
   - **Argumentos**: `C:\Users\Usuario\ERP-ferabensrl-claude\notificador-email.js`
5. Finalizar y probar

---

## 🌐 OPCIÓN 3: SUPABASE EDGE FUNCTION (AVANZADO)

Esta opción requiere conocimientos avanzados de Supabase y Deno.

### 📝 Paso a paso resumido:

1. Instalar Supabase CLI
2. Crear una Edge Function llamada `enviar-notificaciones`
3. Usar Resend API para enviar emails
4. Configurar un cron job para que se ejecute cada 5 minutos
5. Desplegar la función

**Documentación oficial:**
- https://supabase.com/docs/guides/functions
- https://resend.com/docs/send-with-supabase-functions

---

## 🧪 PROBAR EL SISTEMA COMPLETO

### 1. Crear un pedido de prueba

1. Ir al catálogo MARÉ
2. Agregar productos al carrito
3. Enviar el pedido

### 2. Verificar que se creó la notificación

En Supabase SQL Editor, ejecutar:

```sql
SELECT * FROM notificaciones_pendientes
ORDER BY created_at DESC
LIMIT 5;
```

Debería aparecer una notificación con estado `pendiente`.

### 3. Esperar a que se envíe

- **Make.com**: Esperar 5 minutos o ejecutar manualmente
- **Script Node.js**: Esperar 5 minutos o ejecutar `node notificador-email.js`

### 4. Verificar que llegó el email

Revisar la bandeja de entrada de `ventas@mareuy.com`

### 5. Verificar que se marcó como enviada

```sql
SELECT * FROM notificaciones_pendientes
WHERE estado = 'enviado'
ORDER BY enviado_en DESC
LIMIT 5;
```

---

## 📊 MONITOREAR NOTIFICACIONES

### Ver historial completo:

```sql
SELECT
  id,
  tipo,
  destinatario,
  asunto,
  pedido_numero,
  estado,
  intentos,
  created_at,
  enviado_en
FROM notificaciones_pendientes
ORDER BY created_at DESC
LIMIT 20;
```

### Ver notificaciones con error:

```sql
SELECT * FROM notificaciones_pendientes
WHERE estado = 'error'
ORDER BY created_at DESC;
```

### Limpiar notificaciones antiguas (mensual):

```sql
DELETE FROM notificaciones_pendientes
WHERE estado = 'enviado'
AND enviado_en < NOW() - INTERVAL '30 days';
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Problema: Las notificaciones no se crean

**Verificar que el trigger esté activo:**

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_notificar_nuevo_pedido';
```

Debería aparecer `t` en `tgenabled`.

**Reactivar el trigger si es necesario:**

```sql
ALTER TABLE pedidos_recibidos
ENABLE TRIGGER trigger_notificar_nuevo_pedido;
```

### Problema: Los emails no se envían (Script Node.js)

**1. Verificar configuración de Gmail:**

```bash
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tu-email@gmail.com',
    pass: 'tu-contraseña-app'
  }
});
transporter.verify().then(() => console.log('✅ OK')).catch(console.error);
"
```

**2. Error "Invalid login":**
- Verificar que estés usando una contraseña de aplicación (no la contraseña normal)
- Verificar que la verificación en 2 pasos esté activada

**3. Error "Connection timeout":**
- Verificar firewall/antivirus
- Probar con otro puerto (465 con `secure: true`)

### Problema: Make.com no se ejecuta

1. Verificar que el escenario esté **activado** (ON)
2. Revisar los logs en Make.com > History
3. Verificar que las credenciales de Supabase sean correctas
4. Probar ejecutar manualmente con "Run once"

---

## 💡 RECOMENDACIONES

1. **Empezar con Make.com**: Es la opción más fácil y confiable
2. **Probar con un email de prueba primero**: Antes de usar el email real de ventas
3. **Monitorear las primeras semanas**: Verificar que no haya errores
4. **Configurar límites**: En Make.com, configurar un máximo de emails por día

---

## 📞 SOPORTE

Si tienes problemas configurando las notificaciones:

1. Verificar los logs en Supabase
2. Probar ejecutar manualmente el script
3. Revisar la documentación oficial de cada servicio

---

**✅ Una vez configurado, el sistema funcionará automáticamente:**

```
📱 Cliente envía pedido → 💾 Supabase guarda → 🔔 Se crea notificación
     ↓
⏰ Cada 5 minutos → 📧 Se envía email → ✅ Se marca como enviada
```

¡Listo! 🎉
