-- ============================================
-- FIX: Permitir DELETE en pedidos_recibidos
-- ============================================

-- Agregar política de DELETE para usuarios autenticados
CREATE POLICY IF NOT EXISTS "ERP puede eliminar pedidos"
ON pedidos_recibidos
FOR DELETE
TO authenticated
USING (true);

-- Mostrar todas las políticas actuales
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'pedidos_recibidos';
