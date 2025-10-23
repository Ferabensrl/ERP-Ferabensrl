/**
 * ============================================
 * NOTIFICADOR DE EMAILS AUTOMÁTICO
 * ============================================
 * Script Node.js que envía emails cuando llegan nuevos pedidos
 *
 * REQUISITOS:
 * 1. Node.js instalado
 * 2. npm install @supabase/supabase-js nodemailer
 *
 * USO:
 * node notificador-email.js
 *
 * O ejecutarlo automáticamente cada 5 minutos con un servicio como PM2:
 * npm install -g pm2
 * pm2 start notificador-email.js --cron "*/5 * * * *"
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const SUPABASE_URL = 'https://cedspllucwvpoehlyccs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZHNwbGx1Y3d2cG9laGx5Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjkyMTQsImV4cCI6MjA2ODIwNTIxNH0.80z7k6ti2pxBKb8x6NILe--YNaLhJemtC32oqKW-Kz4';

// 📧 CONFIGURAR TU EMAIL SMTP (Gmail, Outlook, etc.)
const EMAIL_CONFIG = {
  host: 'smtp.gmail.com', // Cambiar según tu proveedor
  port: 587,
  secure: false, // true para puerto 465, false para otros
  auth: {
    user: 'tu-email@gmail.com', // 📧 CAMBIAR ESTO
    pass: 'tu-contraseña-app'    // 📧 CAMBIAR ESTO (usar contraseña de aplicación)
  }
};

// Email de destino para las notificaciones
const EMAIL_DESTINO = 'ventas@mareuy.com'; // 📧 CAMBIAR ESTO

// ============================================
// IMPORTS
// ============================================

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// ============================================
// INICIALIZACIÓN
// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function procesarNotificaciones() {
  console.log(`\n[${new Date().toLocaleString('es-AR')}] 🔍 Buscando notificaciones pendientes...`);

  try {
    // Obtener notificaciones pendientes
    const { data: notificaciones, error } = await supabase
      .rpc('obtener_notificaciones_pendientes');

    if (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      return;
    }

    if (!notificaciones || notificaciones.length === 0) {
      console.log('✅ No hay notificaciones pendientes');
      return;
    }

    console.log(`📬 Encontradas ${notificaciones.length} notificaciones pendientes`);

    // Procesar cada notificación
    for (const notif of notificaciones) {
      await enviarNotificacion(notif);
    }

  } catch (err) {
    console.error('❌ Error en procesarNotificaciones:', err);
  }
}

// ============================================
// ENVIAR NOTIFICACIÓN
// ============================================

async function enviarNotificacion(notif) {
  console.log(`\n📧 Enviando ${notif.tipo} a ${notif.destinatario}...`);
  console.log(`   Pedido: ${notif.pedido_numero} - ${notif.pedido_cliente}`);

  try {
    if (notif.tipo === 'email') {
      await enviarEmail(notif);
    } else if (notif.tipo === 'whatsapp') {
      console.log('⚠️ WhatsApp no implementado aún');
      // Aquí podrías integrar con Twilio, WhatsApp Business API, etc.
    } else if (notif.tipo === 'sms') {
      console.log('⚠️ SMS no implementado aún');
      // Aquí podrías integrar con Twilio, etc.
    }

    // Marcar como enviado
    const { error } = await supabase
      .rpc('marcar_notificacion_enviada', {
        notificacion_id: notif.id
      });

    if (error) {
      console.error('❌ Error marcando notificación como enviada:', error);
    } else {
      console.log('✅ Notificación enviada y marcada correctamente');
    }

  } catch (err) {
    console.error('❌ Error enviando notificación:', err);

    // Marcar como error
    await supabase
      .rpc('marcar_notificacion_error', {
        notificacion_id: notif.id,
        mensaje_error: err.message || 'Error desconocido'
      });
  }
}

// ============================================
// ENVIAR EMAIL
// ============================================

async function enviarEmail(notif) {
  const mailOptions = {
    from: EMAIL_CONFIG.auth.user,
    to: notif.destinatario,
    subject: notif.asunto,
    text: notif.mensaje,
    html: generarHTMLEmail(notif)
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('📨 Email enviado:', info.messageId);
}

// ============================================
// GENERAR HTML DEL EMAIL
// ============================================

function generarHTMLEmail(notif) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #8F6A50;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border: 1px solid #ddd;
      border-top: none;
    }
    .pedido-info {
      background-color: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .pedido-info p {
      margin: 8px 0;
    }
    .pedido-info strong {
      color: #8F6A50;
    }
    .total {
      font-size: 1.3em;
      color: #28a745;
      font-weight: bold;
    }
    .button {
      display: inline-block;
      background-color: #8F6A50;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 15px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 0.9em;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛒 Nuevo Pedido Recibido</h1>
    <p>Catálogo MARÉ - Feraben SRL</p>
  </div>

  <div class="content">
    <p>Se ha recibido un nuevo pedido desde el catálogo web que requiere tu atención.</p>

    <div class="pedido-info">
      <p><strong>Número de Pedido:</strong> ${notif.pedido_numero}</p>
      <p><strong>Cliente:</strong> ${notif.pedido_cliente}</p>
      <p class="total"><strong>Total:</strong> $${notif.pedido_total.toLocaleString('es-AR')}</p>
    </div>

    <p>Por favor, ingresa al ERP para revisar el detalle del pedido y aprobarlo para que pase a depósito.</p>

    <center>
      <a href="http://localhost:5173/pedidos-recibidos" class="button">
        Ver Pedido en ERP
      </a>
    </center>
  </div>

  <div class="footer">
    <p>Este es un mensaje automático del sistema ERP Feraben.</p>
    <p>© ${new Date().getFullYear()} Feraben SRL - MARÉ</p>
  </div>
</body>
</html>
  `;
}

// ============================================
// VERIFICAR CONFIGURACIÓN
// ============================================

async function verificarConfiguracion() {
  console.log('🔧 Verificando configuración...\n');

  // Verificar conexión a Supabase
  try {
    const { data, error } = await supabase
      .from('pedidos_recibidos')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('✅ Conexión a Supabase: OK');
  } catch (err) {
    console.error('❌ Error conectando a Supabase:', err.message);
    return false;
  }

  // Verificar configuración de email
  try {
    await transporter.verify();
    console.log('✅ Configuración de email: OK');
  } catch (err) {
    console.error('❌ Error en configuración de email:', err.message);
    console.error('\n📝 AYUDA: Para usar Gmail, necesitas:');
    console.error('   1. Ir a https://myaccount.google.com/security');
    console.error('   2. Activar "Verificación en 2 pasos"');
    console.error('   3. Crear una "Contraseña de aplicación"');
    console.error('   4. Usar esa contraseña en EMAIL_CONFIG.auth.pass\n');
    return false;
  }

  console.log('\n✅ Todo configurado correctamente\n');
  return true;
}

// ============================================
// EJECUCIÓN
// ============================================

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   NOTIFICADOR DE EMAILS - ERP FERABEN    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const configuracionOK = await verificarConfiguracion();

  if (!configuracionOK) {
    console.error('\n❌ Por favor corrige la configuración antes de continuar\n');
    process.exit(1);
  }

  await procesarNotificaciones();

  console.log('\n✅ Proceso completado\n');
}

// Ejecutar
main().catch(console.error);

// ============================================
// INSTRUCCIONES PARA EJECUTAR AUTOMÁTICAMENTE
// ============================================

/*

OPCIÓN 1: Ejecutar manualmente cada vez
----------------------------------------
node notificador-email.js


OPCIÓN 2: Ejecutar automáticamente con PM2
-------------------------------------------
1. Instalar PM2 globalmente:
   npm install -g pm2

2. Ejecutar el script cada 5 minutos:
   pm2 start notificador-email.js --cron "*/5 * * * *"

3. Ver logs:
   pm2 logs notificador-email

4. Detener:
   pm2 stop notificador-email


OPCIÓN 3: Ejecutar como tarea programada de Windows
----------------------------------------------------
1. Abrir "Programador de tareas"
2. Crear tarea básica
3. Trigger: Diariamente, repetir cada 5 minutos
4. Acción: Iniciar programa
   - Programa: C:\Program Files\nodejs\node.exe
   - Argumentos: C:\ruta\a\notificador-email.js


OPCIÓN 4: Usar un cron en Linux/Mac
------------------------------------
1. Editar crontab:
   crontab -e

2. Agregar línea:
   */5 * * * * cd /ruta/al/proyecto && node notificador-email.js >> logs.txt 2>&1

*/
