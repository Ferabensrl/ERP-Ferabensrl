/**
 * ============================================
 * GENERADOR DE PDF PROFESIONAL - ERP FERABEN
 * ============================================
 * Genera PDFs de comprobantes de pedidos recibidos
 * Compatible con el formato del catálogo MARÉ
 */

import { jsPDF } from 'jspdf';
import { type PedidoRecibido, type PedidoRecibidoProducto } from './supabaseClient';

// ============================================
// CONSTANTES
// ============================================

const COLOR_PRIMARIO = { r: 143, g: 106, b: 80 };  // #8F6A50
const COLOR_SECUNDARIO = { r: 227, g: 212, b: 193 }; // #E3D4C1
const MARGEN = 20;
const ANCHO_PAGINA = 210; // A4 width in mm

// ============================================
// TIPOS
// ============================================

export interface DatosPDF {
  pedido: PedidoRecibido;
  clienteNombre: string;
}

// ============================================
// FUNCIÓN PRINCIPAL: Generar PDF Completo
// ============================================

/**
 * Generar PDF de comprobante de pedido
 * @param datos - Datos del pedido a generar
 * @returns Documento jsPDF completo
 */
export const generarComprobantePDF = (datos: DatosPDF): jsPDF => {
  const doc = new jsPDF();

  // Generar página principal (vista para cliente)
  generarPaginaPrincipal(doc, datos);

  return doc;
};

// ============================================
// PÁGINA PRINCIPAL: Vista para Cliente
// ============================================

/**
 * Generar página principal legible para el cliente
 */
const generarPaginaPrincipal = (doc: jsPDF, datos: DatosPDF): void => {
  const fecha = new Date(datos.pedido.fecha_pedido).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let y = MARGEN;

  // ============================================
  // HEADER: Logo y título
  // ============================================
  doc.setFillColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
  doc.rect(0, 0, ANCHO_PAGINA, 40, 'F');

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('MARÉ', ANCHO_PAGINA / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('By Feraben SRL', ANCHO_PAGINA / 2, 28, { align: 'center' });

  y = 50;

  // ============================================
  // TÍTULO: Comprobante de pedido
  // ============================================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('COMPROBANTE DE PEDIDO', ANCHO_PAGINA / 2, y, { align: 'center' });

  y += 15;

  // ============================================
  // INFORMACIÓN DEL PEDIDO
  // ============================================
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');

  // Número de pedido (grande y destacado)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
  doc.text(`Número: ${datos.pedido.numero}`, MARGEN, y);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');

  y += 10;

  // Fecha
  doc.text(`Fecha: ${fecha}`, MARGEN, y);
  y += 7;

  // Cliente
  doc.setFont(undefined, 'bold');
  doc.text('Cliente:', MARGEN, y);
  doc.setFont(undefined, 'normal');
  doc.text(datos.clienteNombre, MARGEN + 20, y);

  y += 12;

  // ============================================
  // LÍNEA SEPARADORA
  // ============================================
  doc.setDrawColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
  doc.setLineWidth(0.5);
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);

  y += 10;

  // ============================================
  // DETALLE DE PRODUCTOS
  // ============================================
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('DETALLE DEL PEDIDO', MARGEN, y);

  y += 10;

  // Headers de la tabla
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Código', MARGEN, y);
  doc.text('Producto', MARGEN + 30, y);
  doc.text('Color/Variante', MARGEN + 85, y);
  doc.text('Cant.', MARGEN + 130, y, { align: 'right' });
  doc.text('Precio Unit.', MARGEN + 157, y, { align: 'right' });
  doc.text('Subtotal', ANCHO_PAGINA - MARGEN, y, { align: 'right' });

  y += 2;
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
  y += 5;

  // ============================================
  // ITEMS DEL PEDIDO
  // ============================================
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);

  let subtotalGeneral = 0;
  const pageHeight = doc.internal.pageSize.height;

  const checkPageBreak = (requiredSpace: number = 15) => {
    if (y + requiredSpace > pageHeight - MARGEN) {
      doc.addPage();
      y = MARGEN;
      return true;
    }
    return false;
  };

  datos.pedido.productos.forEach((producto: PedidoRecibidoProducto, index: number) => {
    checkPageBreak(30);

    // Línea separadora entre productos (excepto el primero)
    if (index > 0) {
      doc.setDrawColor(200, 200, 200); // Gris claro
      doc.setLineWidth(0.3);
      doc.line(MARGEN, y - 2, ANCHO_PAGINA - MARGEN, y - 2);
      y += 3;
    }

    // Código del producto
    doc.setFont(undefined, 'bold');
    doc.text(producto.codigo, MARGEN, y);

    // Nombre del producto (truncar si es muy largo)
    const nombreTruncado = producto.nombre.length > 30
      ? producto.nombre.substring(0, 30) + '...'
      : producto.nombre;
    doc.setFont(undefined, 'normal');
    doc.text(nombreTruncado, MARGEN + 30, y);

    y += 5;

    // Variantes (colores)
    producto.variantes.forEach((variante) => {
      if (variante.cantidad > 0) {
        checkPageBreak(6);

        const subtotal = variante.cantidad * producto.precio_unitario;
        subtotalGeneral += subtotal;

        // Color
        doc.text(`  • ${variante.color}`, MARGEN + 85, y);

        // Cantidad
        doc.text(variante.cantidad.toString(), MARGEN + 130, y, { align: 'right' });

        // Precio unitario
        doc.text(`$${producto.precio_unitario.toLocaleString('es-AR')}`, MARGEN + 157, y, { align: 'right' });

        // Subtotal
        doc.setFont(undefined, 'bold');
        doc.text(`$${subtotal.toLocaleString('es-AR')}`, ANCHO_PAGINA - MARGEN, y, { align: 'right' });
        doc.setFont(undefined, 'normal');

        y += 5;
      }
    });

    // Surtido (si existe)
    if (producto.surtido > 0) {
      checkPageBreak(6);

      const subtotalSurtido = producto.surtido * producto.precio_unitario;
      subtotalGeneral += subtotalSurtido;

      doc.text(`  • Surtido`, MARGEN + 85, y);
      doc.text(producto.surtido.toString(), MARGEN + 130, y, { align: 'right' });
      doc.text(`$${producto.precio_unitario.toLocaleString('es-AR')}`, MARGEN + 157, y, { align: 'right' });
      doc.setFont(undefined, 'bold');
      doc.text(`$${subtotalSurtido.toLocaleString('es-AR')}`, ANCHO_PAGINA - MARGEN, y, { align: 'right' });
      doc.setFont(undefined, 'normal');

      y += 5;
    }

    // Comentario del producto
    if (producto.comentario && producto.comentario.trim() !== '') {
      checkPageBreak(6);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text(`    >> ${producto.comentario.toUpperCase()}`, MARGEN + 30, y);
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
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
  y += 10;

  // ============================================
  // COMENTARIO FINAL
  // ============================================
  if (datos.pedido.comentario_final && datos.pedido.comentario_final.trim() !== '') {
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Observaciones:', MARGEN, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);

    // Dividir texto largo en múltiples líneas
    const comentarioLineas = doc.splitTextToSize(
      datos.pedido.comentario_final,
      ANCHO_PAGINA - 2 * MARGEN
    );

    comentarioLineas.forEach((linea: string) => {
      checkPageBreak(6);
      doc.text(linea, MARGEN, y);
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
  doc.text('TOTAL:', ANCHO_PAGINA - MARGEN - 60, y);
  doc.setTextColor(COLOR_PRIMARIO.r, COLOR_PRIMARIO.g, COLOR_PRIMARIO.b);
  doc.text(
    `$${datos.pedido.total.toLocaleString('es-AR')}`,
    ANCHO_PAGINA - MARGEN,
    y,
    { align: 'right' }
  );
  doc.setTextColor(0, 0, 0);

  y += 15;

  // ============================================
  // FOOTER
  // ============================================
  const footerY = pageHeight - 15;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont(undefined, 'italic');

  doc.text(
    `Generado desde ERP: ${new Date().toLocaleString('es-AR')}`,
    ANCHO_PAGINA / 2,
    footerY,
    { align: 'center' }
  );
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Descargar PDF en el dispositivo
 * @param doc - Documento jsPDF
 * @param numeroPedido - Número del pedido para nombre de archivo
 */
export const descargarPDF = (doc: jsPDF, numeroPedido: string): void => {
  const timestamp = Date.now();
  const nombreArchivo = `Pedido_${numeroPedido}_${timestamp}.pdf`;

  doc.save(nombreArchivo);

  console.log('📄 [PDF] Archivo descargado:', nombreArchivo);
};

// ============================================
// EXPORT DEFAULT
// ============================================
export default {
  generarComprobantePDF,
  descargarPDF
};
