-- ============================================
-- FIX: Permitir DELETE con CASCADE en pedidos_recibidos
-- ============================================
-- Problema: Error 409 al eliminar porque notificaciones_pendientes
-- tiene foreign key que impide la eliminación

-- PASO 1: Eliminar la constraint existente
ALTER TABLE notificaciones_pendientes
DROP CONSTRAINT IF EXISTS notificaciones_pendientes_pedido_id_fkey;

-- PASO 2: Recrear la constraint con ON DELETE CASCADE
-- Esto hará que cuando se elimine un pedido, también se eliminen sus notificaciones
ALTER TABLE notificaciones_pendientes
ADD CONSTRAINT notificaciones_pendientes_pedido_id_fkey
FOREIGN KEY (pedido_id)
REFERENCES pedidos_recibidos(id)
ON DELETE CASCADE;

-- PASO 3: Verificar las constraints
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE conrelid = 'notificaciones_pendientes'::regclass
AND contype = 'f';

-- Nota: confdeltype = 'c' significa CASCADE, 'a' significa NO ACTION
