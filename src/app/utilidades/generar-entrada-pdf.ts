import jsPDF from 'jspdf';
import * as QRCode from 'qrcode';

/**
 * generarEntradaPDF - Genera el comprobante, con QR y se puede descargar.
 * Recibe el objeto que devuelve authService.obtenerDatosTicket(entradaId): la pelicula,
 * la sala, el dia/horario y las butacas ya vienen anidados adentro por el select con joins.
 */
export async function generarEntradaPDF(entrada: any) {
  const pelicula = entrada.funciones?.peliculas;
  const sala = entrada.funciones?.salas;
  const butacas = (entrada.entrada_butacas || [])
    .map((eb: any) => `${eb.butacas.fila}-${eb.butacas.numero}`)
    .join(', ');

  // el codigo es texto plano (no un id cualquiera oculto), asi el empleado lo
  // puede tipear a mano si el lector de QR falla ese dia
  const codigo = `ENTRADA-${entrada.id}`;
  const qrDataUrl = await QRCode.toDataURL(codigo, { width: 220, margin: 1 });

  // documento con tamaño tipo ticket (80mm de ancho), no una hoja A4 entera
  const doc = new jsPDF({ format: [80, 190], unit: 'mm' });
  const centro = 40; // mitad del ancho (80mm), para centrar título y QR

  // encabezado del ticket
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text('ROXIS MOVIES', centro, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Comprobante de entrada', centro, 16, { align: 'center' });

  // linea divisoria punteada
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 20, 75, 20);

  // datos de la funcion, uno debajo del otro
  let y = 27;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`Pelicula: ${pelicula?.titulo ?? '-'}`, 5, y);
  y += 6;
  doc.text(`Sala: ${sala?.nombre ?? '-'}`, 5, y);
  y += 6;
  doc.text(`Dia/horario: ${entrada.funciones?.dia ?? '-'} ${entrada.funciones?.horario ?? '-'}`, 5, y);
  y += 6;
  doc.text(`Butacas: ${butacas || '-'}`, 5, y);
  y += 8;

  // si la pelicula tiene restriccion de edad, se aclara en el ticket
  if (pelicula?.clasificacion && pelicula.clasificacion !== 'ATP') {
    doc.setTextColor(200, 0, 0);
    doc.text(`Clasificacion ${pelicula.clasificacion}: los`, 5, y);
    y += 4;
    doc.text('menores deben ir con un adulto.', 5, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // linea separadora antes del total
  doc.line(5, y, 75, y);
  y += 8;

  // total pagado, en grande y alineado a la derecha 
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL:', 5, y);
  doc.text(`$${entrada.total}`, 75, y, { align: 'right' });
  y += 12;

  // QR centrado, con el codigo tambien como texto por si hay que tipearlo a mano
  doc.addImage(qrDataUrl, 'PNG', centro - 20, y, 40, 40);
  y += 46;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`Codigo: ${codigo}`, centro, y, { align: 'center' });
  y += 8;

  // mensaje de cierre del ticket
  doc.text('Presenta este QR (o el codigo a mano)', centro, y, { align: 'center' });
  y += 4;
  doc.text('en el cine y en el candy bar.', centro, y, { align: 'center' });

  doc.save(`entrada-${entrada.id}.pdf`);
}
