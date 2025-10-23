-- ============================================
-- TRIGGER: Enviar notificación cuando llega un nuevo pedido
-- ============================================
-- Este trigger se activará cuando se inserte un nuevo registro en pedidos_recibidos
-- Y enviará una notificación (a implementar con webhook o edge function)

-- OPCIÓN 1: Usar con servicio externo como Zapier, Make.com, n8n
-- Configurar un webhook en Supabase Dashboard que llame a estos servicios

-- OPCIÓN 2: Crear una Edge Function en Supabase
-- Aquí está el código SQL para crear la tabla de notificaciones pendientes

-- Tabla para guardar notificaciones pendientes
CREATE TABLE IF NOT EXISTS notificaciones_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'email', 'whatsapp', 'sms'
  destinatario TEXT NOT NULL, -- email o teléfono
  asunto TEXT,
  mensaje TEXT NOT NULL,
  pedido_id UUID REFERENCES pedidos_recibidos(id),
  pedido_numero TEXT,
  pedido_cliente TEXT,
  pedido_total NUMERIC(10,2),
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'enviado', 'error'
  intentos INTEGER DEFAULT 0,
  error_mensaje TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  enviado_en TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created ON notificaciones_pendientes(created_at);

-- Función que se ejecuta cuando se inserta un nuevo pedido
CREATE OR REPLACE FUNCTION notificar_nuevo_pedido()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo notificar para pedidos nuevos con estado 'recibido' y origen 'catalogo_web'
  IF NEW.estado = 'recibido' AND NEW.origen = 'catalogo_web' THEN

    -- Insertar notificación de email
    INSERT INTO notificaciones_pendientes (
      tipo,
      destinatario,
      asunto,
      mensaje,
      pedido_id,
      pedido_numero,
      pedido_cliente,
      pedido_total
    ) VALUES (
      'email',
      'ventas@mareuy.com', -- 📧 CAMBIAR ESTE EMAIL POR EL TUYO
      '🛒 Nuevo Pedido Recibido - ' || NEW.numero,
      format(
        E'Se ha recibido un nuevo pedido desde el catálogo MARÉ:\n\n' ||
        'Número: %s\n' ||
        'Cliente: %s\n' ||
        'Total: $%s\n' ||
        'Fecha: %s\n\n' ||
        'Ingresa al ERP para revisar y aprobar el pedido:\n' ||
        'https://erp-ferabensrl.vercel.app/pedidos-recibidos',
        NEW.numero,
        NEW.cliente_nombre,
        NEW.total,
        to_char(NEW.fecha_pedido, 'DD/MM/YYYY HH24:MI')
      ),
      NEW.id,
      NEW.numero,
      NEW.cliente_nombre,
      NEW.total
    );

    RAISE NOTICE 'Notificación creada para pedido %', NEW.numero;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta DESPUÉS de insertar un pedido
DROP TRIGGER IF EXISTS trigger_notificar_nuevo_pedido ON pedidos_recibidos;
CREATE TRIGGER trigger_notificar_nuevo_pedido
  AFTER INSERT ON pedidos_recibidos
  FOR EACH ROW
  EXECUTE FUNCTION notificar_nuevo_pedido();

-- ============================================
-- FUNCIÓN RPC: Marcar notificación como enviada
-- ============================================
CREATE OR REPLACE FUNCTION marcar_notificacion_enviada(
  notificacion_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE notificaciones_pendientes
  SET
    estado = 'enviado',
    enviado_en = NOW()
  WHERE id = notificacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN RPC: Marcar notificación como error
-- ============================================
CREATE OR REPLACE FUNCTION marcar_notificacion_error(
  notificacion_id UUID,
  mensaje_error TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE notificaciones_pendientes
  SET
    estado = 'error',
    intentos = intentos + 1,
    error_mensaje = mensaje_error
  WHERE id = notificacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN RPC: Obtener notificaciones pendientes
-- ============================================
CREATE OR REPLACE FUNCTION obtener_notificaciones_pendientes()
RETURNS TABLE (
  id UUID,
  tipo TEXT,
  destinatario TEXT,
  asunto TEXT,
  mensaje TEXT,
  pedido_numero TEXT,
  pedido_cliente TEXT,
  pedido_total NUMERIC,
  intentos INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.tipo,
    n.destinatario,
    n.asunto,
    n.mensaje,
    n.pedido_numero,
    n.pedido_cliente,
    n.pedido_total,
    n.intentos
  FROM notificaciones_pendientes n
  WHERE n.estado = 'pendiente'
  AND n.intentos < 3 -- Máximo 3 intentos
  ORDER BY n.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
ALTER TABLE notificaciones_pendientes ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer notificaciones
CREATE POLICY "Permitir lectura de notificaciones a usuarios autenticados"
  ON notificaciones_pendientes
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================

-- 1. Ejecutar este script en el SQL Editor de Supabase

-- 2. CONFIGURAR EMAIL:
--    - ✅ Email configurado: ventas@mareuy.com
--    - ✅ URL del ERP configurada: https://erp-ferabensrl.vercel.app/pedidos-recibidos

-- 3. OPCIONES PARA ENVIAR EMAILS:

--    OPCIÓN A: Usar Make.com / Zapier (RECOMENDADO - GRATIS)
--    --------------------------------------------------------
--    1. Crear cuenta gratuita en make.com o zapier.com
--    2. Crear un escenario que cada 5 minutos:
--       - Llama a Supabase: obtener_notificaciones_pendientes()
--       - Para cada notificación, envía un email
--       - Marca como enviada: marcar_notificacion_enviada(id)
--    3. Make.com tiene integración directa con Gmail/Outlook

--    OPCIÓN B: Usar Supabase Edge Function (AVANZADO)
--    ------------------------------------------------
--    1. Crear una Edge Function que:
--       - Se ejecuta cada 5 minutos (cron)
--       - Lee notificaciones pendientes
--       - Usa Resend API para enviar emails
--       - Marca como enviadas/error

--    OPCIÓN C: Usar servicio simple en tu servidor
--    ----------------------------------------------
--    1. Crear un script que cada 5 minutos:
--       - Consulta notificaciones pendientes
--       - Envía emails con nodemailer/smtp
--       - Marca como enviadas

-- 4. PROBAR EL SISTEMA:
--    - Crear un pedido de prueba desde el catálogo
--    - Verificar que se crea registro en notificaciones_pendientes:
SELECT * FROM notificaciones_pendientes ORDER BY created_at DESC LIMIT 5;

-- 5. VER HISTORIAL DE NOTIFICACIONES:
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

-- ============================================
-- LIMPIEZA (opcional - ejecutar cada mes)
-- ============================================

-- Eliminar notificaciones enviadas hace más de 30 días
-- DELETE FROM notificaciones_pendientes
-- WHERE estado = 'enviado'
-- AND enviado_en < NOW() - INTERVAL '30 days';

-- ============================================
-- DESACTIVAR TEMPORALMENTE (si es necesario)
-- ============================================

-- Para desactivar temporalmente el trigger:
-- ALTER TABLE pedidos_recibidos DISABLE TRIGGER trigger_notificar_nuevo_pedido;

-- Para reactivarlo:
-- ALTER TABLE pedidos_recibidos ENABLE TRIGGER trigger_notificar_nuevo_pedido;
