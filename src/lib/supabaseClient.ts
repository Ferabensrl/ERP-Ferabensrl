// src/lib/supabaseClient.ts - VERSIÓN CORREGIDA COMPLETA
// PARTE 1/8 - IMPORTS Y CONFIGURACIÓN

import { createClient } from '@supabase/supabase-js'

// ✅ Configuración de Supabase - COMPATIBLE CON VARIABLES EXISTENTES
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL || 'https://cedspllucwvpoehlyccs.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZHNwbGx1Y3d2cG9laGx5Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjkyMTQsImV4cCI6MjA2ODIwNTIxNH0.80z7k6ti2pxBKb8x6NILe--YNaLhJemtC32oqKW-Kz4'

console.log('✅ Supabase conectado:', supabaseUrl);

// Cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ===== TIPOS TYPESCRIPT PARA SUPABASE =====
export interface DbProducto {
  id: number
  codigo_producto: string
  codigo_barras: string
  descripcion: string
  categoria: string
  stock: number
  precio_venta: number
  precio_costo?: number
  stock_minimo: number
  proveedor?: string
  created_at: string
  activo: boolean
}

export interface DbPedido {
  id: number
  numero: string
  cliente_nombre: string
  cliente_telefono?: string
  cliente_direccion?: string
  fecha_pedido: string
  fecha_completado?: string
  estado: 'pendiente' | 'preparando' | 'completado' | 'entregado'
  origen: 'whatsapp' | 'manual' | 'escaner'
  productos?: any // Mantener por compatibilidad
  comentarios?: string
  total?: number
  created_at?: string
  updated_at?: string
}

export interface DbPedidoItem {
  id?: number // Es opcional porque Supabase lo genera
  pedido_id: number
  codigo_producto: string
  cantidad_pedida: number
  cantidad_preparada: number
  precio_unitario: number
  estado: 'pendiente' | 'completado' | 'sin_stock'
  variante_color?: string
  comentarios?: string
  created_at?: string
  updated_at?: string
}
// PARTE 2/8 - FUNCIONES DE PRODUCTOS

// ===== FUNCIONES DE PRODUCTOS =====
export const productosService = {
  // Obtener todos los productos
  async getAll(): Promise<DbProducto[]> {
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('activo', true)
        .order('descripcion')
      
      if (error) {
        console.error('Error al obtener productos:', error)
        throw error
      }
      
      return data || []
    } catch (error) {
      console.error('Error en productosService.getAll:', error)
      throw error
    }
  },

  // ✅ FUNCIÓN CORREGIDA: Buscar producto por código
  async getByCodigo(codigo: string): Promise<DbProducto | null> {
    try {
      console.log(`🔍 Buscando producto con código: "${codigo}"`);
      
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('codigo_producto', codigo)
        .eq('activo', true)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // PGRST116 es "no rows found" - esto es normal, no es un error
          console.log(`⚠️ Producto ${codigo} no encontrado en la base de datos`);
          return null;
        } else {
          console.error('Error al buscar producto:', error)
          throw error
        }
      }
      
      console.log(`✅ Producto ${codigo} encontrado:`, data);
      return data
    } catch (error) {
      console.error(`❌ Error en productosService.getByCodigo para código ${codigo}:`, error)
      throw error
    }
  },

  // ✅ MÉTODO REQUERIDO: buscarPorCodigo (alias para getByCodigo)
  async buscarPorCodigo(codigo: string): Promise<DbProducto | null> {
    return this.getByCodigo(codigo);
  },

  // Actualizar stock
  async updateStock(id: number, nuevoStock: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('inventario')
        .update({ stock: nuevoStock })
        .eq('id', id)
      
      if (error) {
        console.error('Error al actualizar stock:', error)
        throw error
      }
    } catch (error) {
      console.error('Error en productosService.updateStock:', error)
      throw error
    }
  },

  // ✅ NUEVA FUNCIÓN: Reducir stock por código de producto
  async reducirStock(codigoProducto: string, cantidadAReducir: number): Promise<{success: boolean, stockAnterior: number, stockNuevo: number}> {
    try {
      console.log(`🔄 Reduciendo stock para ${codigoProducto}: -${cantidadAReducir}`);
      
      // Buscar el producto por código
      const producto = await this.getByCodigo(codigoProducto);
      if (!producto) {
        throw new Error(`Producto con código ${codigoProducto} no encontrado`);
      }

      const stockAnterior = producto.stock;
      const stockNuevo = Math.max(0, stockAnterior - cantidadAReducir);
      
      // Actualizar el stock
      await this.updateStock(producto.id, stockNuevo);
      
      console.log(`✅ Stock actualizado: ${codigoProducto} | ${stockAnterior} → ${stockNuevo}`);
      
      return {
        success: true,
        stockAnterior,
        stockNuevo
      };
    } catch (error) {
      console.error('❌ Error reduciendo stock:', error);
      throw error;
    }
  },

  // ✅ NUEVA FUNCIÓN: Procesar reducción de stock masiva para pedido completado
  async procesarReduccionStockPedido(productosPreparados: Array<{codigo: string, cantidadPreparada: number, variantes?: Array<{color: string, cantidadPreparada: number}>}>): Promise<Array<{codigo: string, resultado: string}>> {
    const resultados: Array<{codigo: string, resultado: string}> = [];
    
    try {
      console.log('🏭 Procesando reducción de stock masiva para pedido completado...');
      
      for (const producto of productosPreparados) {
        try {
          let cantidadTotalPreparada = 0;
          
          // Calcular cantidad total (con o sin variantes)
          if (producto.variantes && producto.variantes.length > 0) {
            cantidadTotalPreparada = producto.variantes.reduce((sum, v) => sum + v.cantidadPreparada, 0);
          } else {
            cantidadTotalPreparada = producto.cantidadPreparada;
          }
          
          if (cantidadTotalPreparada > 0) {
            const resultado = await this.reducirStock(producto.codigo, cantidadTotalPreparada);
            resultados.push({
              codigo: producto.codigo,
              resultado: `✅ ${resultado.stockAnterior} → ${resultado.stockNuevo} (-${cantidadTotalPreparada})`
            });
          } else {
            resultados.push({
              codigo: producto.codigo,
              resultado: '⚪ Sin reducción (cantidad preparada: 0)'
            });
          }
        } catch (error) {
          resultados.push({
            codigo: producto.codigo,
            resultado: `❌ Error: ${error}`
          });
        }
      }
      
      console.log('📊 Resultados de reducción de stock:', resultados);
      return resultados;
      
    } catch (error) {
      console.error('❌ Error en procesamiento masivo:', error);
      throw error;
    }
  }
}
// PARTE 3/8 - FUNCIONES DE PEDIDOS - INICIO

// ===== FUNCIONES DE PEDIDOS CORREGIDAS =====
export const pedidosService = {
  // ✅ FUNCIÓN PRINCIPAL CORREGIDA
  async insertPedidoWithItems(
    pedido: Omit<DbPedido, 'id' | 'created_at' | 'updated_at'>,
    items: Omit<DbPedidoItem, 'id' | 'created_at' | 'updated_at' | 'pedido_id'>[]
  ): Promise<DbPedido> {
    try {
      console.log('🚀 Iniciando inserción de pedido con items...');
      console.log('📦 Datos del pedido:', pedido);
      console.log('📋 Items del pedido:', items);

      // 1. Insertar el pedido principal
      console.log('📝 Insertando pedido principal...');
      const { data: insertedPedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert(pedido)
        .select()
        .single()

      if (pedidoError) {
        console.error('❌ Error al insertar pedido:', pedidoError)
        throw pedidoError
      }

      if (!insertedPedido) {
        throw new Error('No se pudo obtener el pedido insertado.')
      }

      console.log('✅ Pedido principal insertado:', insertedPedido);

      // 2. Insertar los ítems del pedido, vinculándolos al pedido principal
      console.log('📋 Insertando items del pedido...');
      const itemsToInsert = items.map(item => ({
        ...item,
        pedido_id: insertedPedido.id,
      }))

      console.log('📋 Items preparados para insertar:', itemsToInsert);

      const { data: insertedItems, error: itemsError } = await supabase
        .from('pedido_items')
        .insert(itemsToInsert)
        .select()

      if (itemsError) {
        console.error('❌ Error al insertar ítems del pedido:', itemsError)
        
        // ✅ ROLLBACK: Intentar eliminar el pedido principal si los items fallan
        console.log('🔄 Intentando rollback del pedido principal...');
        try {
          await supabase
            .from('pedidos')
            .delete()
            .eq('id', insertedPedido.id)
          console.log('✅ Rollback completado');
        } catch (rollbackError) {
          console.error('❌ Error en rollback:', rollbackError);
        }
        
        throw itemsError
      }

      console.log('✅ Items insertados exitosamente:', insertedItems);
      console.log('🎉 Pedido completo creado exitosamente');

      return insertedPedido
    } catch (error) {
      console.error('❌ Error general en insertPedidoWithItems:', error)
      throw error
    }
  },
  // PARTE 4/8 - MÉTODO CREAR REQUERIDO PARA WHATSAPP

  // ✅ MÉTODO REQUERIDO: crear (alias para insertPedidoWithItems)
  async crear(pedidoData: Omit<DbPedido, 'id' | 'created_at' | 'updated_at'>): Promise<DbPedido> {
    try {
      console.log('🚀 Creando pedido desde WhatsApp...');
      
      // Convertir productos del formato WhatsApp al formato de items
      const items: Omit<DbPedidoItem, 'id' | 'created_at' | 'updated_at' | 'pedido_id'>[] = [];
      
      if (pedidoData.productos && Array.isArray(pedidoData.productos)) {
        for (const producto of pedidoData.productos) {
          if (producto.variantes && Array.isArray(producto.variantes)) {
            // Producto con variantes
            for (const variante of producto.variantes) {
              items.push({
                codigo_producto: producto.codigo_producto || '',
                cantidad_pedida: variante.cantidad || 0,
                cantidad_preparada: 0,
                precio_unitario: producto.precio_unitario || 0,
                estado: 'pendiente',
                variante_color: variante.color || '',
                comentarios: producto.comentario || ''
              });
            }
          } else {
            // Producto sin variantes
            items.push({
              codigo_producto: producto.codigo_producto || '',
              cantidad_pedida: producto.cantidad_pedida || 0,
              cantidad_preparada: 0,
              precio_unitario: producto.precio_unitario || 0,
              estado: 'pendiente',
              variante_color: '',
              comentarios: producto.comentario || ''
            });
          }
        }
      }

      // Crear pedido usando el método existente
      return await this.insertPedidoWithItems(pedidoData, items);
      
    } catch (error) {
      console.error('❌ Error en pedidosService.crear:', error);
      throw error;
    }
  },
  // PARTE 5/8 - MÉTODOS ADICIONALES DE PEDIDOS

  // ✅ FUNCIÓN ADICIONAL: Obtener pedidos
  async getAll(): Promise<DbPedido[]> {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error al obtener pedidos:', error)
        throw error
      }
      
      return data || []
    } catch (error) {
      console.error('Error en pedidosService.getAll:', error)
      throw error
    }
  },

  // ✅ FUNCIÓN ADICIONAL: Obtener items de un pedido
  async getItemsByPedidoId(pedidoId: number): Promise<DbPedidoItem[]> {
    try {
      const { data, error } = await supabase
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at')
      
      if (error) {
        console.error('Error al obtener items del pedido:', error)
        throw error
      }
      
      return data || []
    } catch (error) {
      console.error('Error en pedidosService.getItemsByPedidoId:', error)
      throw error
    }
  },

  // ✅ NUEVA FUNCIÓN: Actualizar progreso de preparación en Supabase
  async actualizarProgresoPreparacion(
    pedidoId: number,
    comentarios: string,
    items: Array<{
      codigo_producto: string;
      cantidad_preparada: number;
      estado: 'pendiente' | 'completado' | 'sin_stock';
      variante_color?: string;
    }>
  ): Promise<void> {
    try {
      console.log('🔄 Actualizando progreso en Supabase...', { pedidoId, itemsCount: items.length });

      // 1. Actualizar comentarios del pedido
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({ 
          comentarios: comentarios,
          estado: 'preparando',
          updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);

      if (pedidoError) {
        console.error('❌ Error actualizando pedido:', pedidoError);
        throw pedidoError;
      }

      // 2. Actualizar cada item individualmente
      for (const item of items) {
        const { error: itemError } = await supabase
          .from('pedido_items')
          .update({
            cantidad_preparada: item.cantidad_preparada,
            estado: item.estado,
            updated_at: new Date().toISOString()
          })
          .eq('pedido_id', pedidoId)
          .eq('codigo_producto', item.codigo_producto)
          .eq('variante_color', item.variante_color || '');

        if (itemError) {
          console.error(`❌ Error actualizando item ${item.codigo_producto}:`, itemError);
          throw itemError;
        }
      }

      console.log('✅ Progreso actualizado en Supabase exitosamente');
    } catch (error) {
      console.error('❌ Error en actualizarProgresoPreparacion:', error);
      throw error;
    }
  },

  // ✅ NUEVA FUNCIÓN: Finalizar pedido con actualización completa
  async finalizarPedidoCompleto(
    pedidoId: number,
    comentariosFinal: string,
    items: Array<{
      codigo_producto: string;
      cantidad_preparada: number;
      estado: 'pendiente' | 'completado' | 'sin_stock';
      variante_color?: string;
    }>
  ): Promise<void> {
    try {
      console.log('🎯 Finalizando pedido completo en Supabase...', { pedidoId });

      // 1. Actualizar pedido a completado
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({ 
          estado: 'completado',
          comentarios: comentariosFinal,
          fecha_completado: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId);

      if (pedidoError) {
        console.error('❌ Error finalizando pedido:', pedidoError);
        throw pedidoError;
      }

      // 2. Actualizar todos los items con cantidades finales
      for (const item of items) {
        const { error: itemError } = await supabase
          .from('pedido_items')
          .update({
            cantidad_preparada: item.cantidad_preparada,
            estado: item.estado,
            updated_at: new Date().toISOString()
          })
          .eq('pedido_id', pedidoId)
          .eq('codigo_producto', item.codigo_producto)
          .eq('variante_color', item.variante_color || '');

        if (itemError) {
          console.error(`❌ Error finalizando item ${item.codigo_producto}:`, itemError);
          throw itemError;
        }
      }

      console.log('✅ Pedido finalizado completamente en Supabase');
    } catch (error) {
      console.error('❌ Error en finalizarPedidoCompleto:', error);
      throw error;
    }
  },

  // ✅ NUEVA FUNCIÓN: Actualizar productos de pedido editado
  async actualizarProductosPedido(
    pedidoId: number,
    productos: Array<{
      id: string;
      codigo: string;
      nombre: string;
      cantidadPedida: number;
      precio?: number;
      comentario?: string;
    }>
  ): Promise<void> {
    try {
      console.log('🔄 Actualizando productos del pedido:', pedidoId);
      
      // 1. Eliminar todos los items existentes del pedido
      const { error: deleteError } = await supabase
        .from('pedido_items')
        .delete()
        .eq('pedido_id', pedidoId);

      if (deleteError) {
        console.error('❌ Error eliminando items existentes:', deleteError);
        throw deleteError;
      }

      // 2. Insertar los nuevos items
      const nuevosItems = productos.map(producto => ({
        pedido_id: pedidoId,
        codigo_producto: producto.codigo,
        cantidad_pedida: producto.cantidadPedida,
        cantidad_preparada: 0,
        precio_unitario: producto.precio || 0,
        estado: 'pendiente' as const,
        variante_color: '',
        comentarios: producto.comentario || ''
      }));

      const { error: insertError } = await supabase
        .from('pedido_items')
        .insert(nuevosItems);

      if (insertError) {
        console.error('❌ Error insertando nuevos items:', insertError);
        throw insertError;
      }

      // 3. Actualizar timestamp del pedido
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', pedidoId);

      if (updateError) {
        console.error('❌ Error actualizando timestamp:', updateError);
        throw updateError;
      }

      console.log('✅ Productos del pedido actualizados exitosamente');
    } catch (error) {
      console.error('❌ Error en actualizarProductosPedido:', error);
      throw error;
    }
  }
}
// PARTE 6/8 - UTILIDADES

// ===== UTILIDADES =====
export const utils = {
  // Verificar conexión con Supabase
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔌 Probando conexión con Supabase...');
      const { data, error } = await supabase
        .from('inventario')
        .select('count(*)')
        .limit(1)
      
      if (error) {
        console.error('❌ Error de conexión:', error);
        return false;
      }
      
      console.log('✅ Conexión exitosa con Supabase');
      return true;
    } catch (error) {
      console.error('❌ Error de conexión:', error)
      return false
    }
  },

  // ✅ NUEVA UTILIDAD: Verificar estructura de tablas
  async checkTablesStructure(): Promise<void> {
    try {
      console.log('🔍 Verificando estructura de tablas...');
      
      // Verificar tabla inventario
      const { data: inventarioData, error: inventarioError } = await supabase
        .from('inventario')
        .select('*')
        .limit(1)
      
      if (inventarioError) {
        console.error('❌ Error accediendo tabla inventario:', inventarioError);
      } else {
        console.log('✅ Tabla inventario accesible');
      }
      
      // Verificar tabla pedidos
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .limit(1)
      
      if (pedidosError) {
        console.error('❌ Error accediendo tabla pedidos:', pedidosError);
      } else {
        console.log('✅ Tabla pedidos accesible');
      }
      
      // Verificar tabla pedido_items
      const { data: itemsData, error: itemsError } = await supabase
        .from('pedido_items')
        .select('*')
        .limit(1)
      
      if (itemsError) {
        console.error('❌ Error accediendo tabla pedido_items:', itemsError);
      } else {
        console.log('✅ Tabla pedido_items accesible');
      }
      
    } catch (error) {
      console.error('❌ Error verificando estructura:', error);
    }
  }
}
// PARTE 7/8 - FUNCIONES DE TEST Y DEBUG

// ===== FUNCIONES DE TEST Y DEBUG =====
export const testFunctions = {
  // Test de inserción de pedido completo
  async testInsertPedido(): Promise<void> {
    try {
      console.log('🧪 Iniciando test de inserción de pedido...');
      
      const testPedido: Omit<DbPedido, 'id' | 'created_at' | 'updated_at'> = {
        numero: `TEST-${Date.now()}`,
        cliente_nombre: 'Cliente Test',
        cliente_telefono: '+598 99 123 456',
        fecha_pedido: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
        origen: 'whatsapp',
        comentarios: 'Pedido de prueba desde sistema',
        total: 1500
      };

      const testItems: Omit<DbPedidoItem, 'id' | 'created_at' | 'updated_at' | 'pedido_id'>[] = [
        {
          codigo_producto: 'TEST001',
          cantidad_pedida: 2,
          cantidad_preparada: 0,
          precio_unitario: 500,
          estado: 'pendiente',
          variante_color: 'Azul',
          comentarios: 'Item de prueba 1'
        },
        {
          codigo_producto: 'TEST002',
          cantidad_pedida: 1,
          cantidad_preparada: 0,
          precio_unitario: 500,
          estado: 'pendiente',
          variante_color: 'Rojo',
          comentarios: 'Item de prueba 2'
        }
      ];

      const resultado = await pedidosService.insertPedidoWithItems(testPedido, testItems);
      console.log('✅ Test completado exitosamente:', resultado);
      
    } catch (error) {
      console.error('❌ Error en test:', error);
    }
  },

  // Test de búsqueda de productos
  async testBuscarProducto(codigo: string = 'A1001'): Promise<void> {
    try {
      console.log(`🧪 Iniciando test de búsqueda de producto: ${codigo}`);
      
      const producto = await productosService.buscarPorCodigo(codigo);
      
      if (producto) {
        console.log('✅ Producto encontrado:', producto);
      } else {
        console.log('⚠️ Producto no encontrado');
      }
      
    } catch (error) {
      console.error('❌ Error en test de búsqueda:', error);
    }
  }
}
// PARTE 8/8 - EXPORT POR DEFECTO Y FUNCIONES FINALES

// ===== FUNCIONES DE MANTENIMIENTO =====
export const maintenance = {
  // Limpiar pedidos de prueba
  async cleanTestData(): Promise<void> {
    try {
      console.log('🧹 Limpiando datos de prueba...');
      
      // Eliminar pedidos que empiecen con "TEST-"
      const { error: pedidosError } = await supabase
        .from('pedidos')
        .delete()
        .like('numero', 'TEST-%');
      
      if (pedidosError) {
        console.error('❌ Error limpiando pedidos de prueba:', pedidosError);
      } else {
        console.log('✅ Pedidos de prueba eliminados');
      }
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
    }
  },

  // Obtener estadísticas básicas
  async getStats(): Promise<void> {
    try {
      console.log('📊 Obteniendo estadísticas...');
      
      // Contar productos
      const { count: productosCount } = await supabase
        .from('inventario')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);
      
      // Contar pedidos
      const { count: pedidosCount } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📦 Productos activos: ${productosCount || 0}`);
      console.log(`📋 Pedidos totales: ${pedidosCount || 0}`);
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
    }
  }
}

// ===== EXPORT POR DEFECTO =====
export default {
  supabase,
  productosService,
  pedidosService,
  utils,
  testFunctions,
  maintenance
}