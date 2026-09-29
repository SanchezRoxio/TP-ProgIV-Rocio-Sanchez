import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { generarEntradaPDF } from '../../utilidades/generar-entrada-pdf';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pago.html',
  styleUrl: './pago.css'
})
export class PagoComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  seleccion: any = null;
  candySeleccionado: any[] = [];
  combosSeleccionados: any[] = [];
  butacasCubiertasPorCombo: number = 0; // cuántas de las butacas seleccionadas ya están pagas por un combo
  subtotalEntradas: number = 0;
  codigoCupon: string = '';
  descuentoAplicado: number = 0;
  usarCredito: boolean = false;
  creditoDisponible: number = 0;
  procesando = false;

  ngOnInit() {
    // el credito sale de una cancelacion anterior (o 0 si nunca cancelaste
    // nada, o si sos invitado sin cuenta)
    const usuario = this.authService.usuarioActual();
    this.creditoDisponible = usuario?.credito ?? 0;

    const navigation = history.state;
    if (navigation && navigation.seleccion) {
      this.seleccion = navigation.seleccion;
    }
    if (navigation && navigation.candy) {
      this.candySeleccionado = navigation.candy;
    }
    if (navigation && navigation.combos) {
      this.combosSeleccionados = navigation.combos;
    }
    if (navigation && navigation.butacasCubiertasPorCombo) {
      this.butacasCubiertasPorCombo = navigation.butacasCubiertasPorCombo;
    }

    if (this.seleccion) {
      // las primeras N butacas (según cuántos combos elegiste) ya están pagas
      // dentro del precio del combo, así que no las sumo de nuevo acá
      const butacasQueSePaganAparte = this.seleccion.butacas.slice(this.butacasCubiertasPorCombo);
      this.subtotalEntradas = butacasQueSePaganAparte.reduce(
        (acc: number, b: any) => acc + b.precio,
        0
      );
    }
  }

  etiquetasButacas(): string {
    if (!this.seleccion) return '';
    return this.seleccion.butacas.map((b: any) => `${b.fila}-${b.numero}`).join(', ');
  }

  getSubtotalCandy(): number {
    return this.candySeleccionado.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
  }

  getSubtotalCombos(): number {
    return this.combosSeleccionados.reduce((acc, c) => acc + (c.precio * c.cantidad), 0);
  }

  // no uso todo el credito disponible siempre, solo lo que haga falta para
  // llegar a $0 (si tenés $5000 de credito y la compra sale $3000, te quedan
  // $2000 de credito para la próxima, no se pierden)
  calcularCreditoUsado(): number {
    if (!this.usarCredito) return 0;
    const totalSinCredito = Math.max(0, (this.subtotalEntradas + this.getSubtotalCandy() + this.getSubtotalCombos()) - this.descuentoAplicado);
    return Math.min(this.creditoDisponible, totalSinCredito);
  }

  calcularTotal(): number {
    const totalSinCredito = (this.subtotalEntradas + this.getSubtotalCandy() + this.getSubtotalCombos()) - this.descuentoAplicado;
    return Math.max(0, totalSinCredito - this.calcularCreditoUsado());
  }

  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  async aplicarCupon() {
    if (!this.codigoCupon.trim()) return;

    try {
      // validarCupon ya se fija que exista, este activo, y no haya vencido.
      // le mando el id y la fecha de nacimiento (si hay usuario logueado) para
      // que pueda validar tambien los cupones de mayores de 50 y de primera compra
      const usuario = this.authService.usuarioActual();
      const cupon = await this.authService.validarCupon(this.codigoCupon, usuario?.id ?? null, usuario?.fecha_nacimiento ?? null);

      if (!cupon) {
        this.descuentoAplicado = 0;
        this.mensajeError.set('Cupón inválido o expirado.');
        this.mensajeExito.set(null);
        return;
      }

      this.descuentoAplicado = (this.subtotalEntradas + this.getSubtotalCandy() + this.getSubtotalCombos()) * (cupon.descuento_porcentaje / 100);
      this.mensajeExito.set(`¡Cupón de ${cupon.descuento_porcentaje}% aplicado con éxito!`);
      this.mensajeError.set(null);
    } catch (error) {
      this.mensajeError.set('No se pudo validar el cupón.');
      this.mensajeExito.set(null);
    }
  }

  async finalizarCompra() {
    if (!this.seleccion || !this.seleccion.butacas.length) {
      this.mensajeError.set('No hay butacas seleccionadas.');
      return;
    }

    this.procesando = true;
    this.mensajeError.set(null);

    try {
      const usuario = this.authService.usuarioActual();

      const entrada = await this.authService.finalizarCompra({
        usuarioId: usuario ? usuario.id : null,
        funcionId: this.seleccion.funcionId,
        total: this.calcularTotal(),
        creditoUsado: this.calcularCreditoUsado(),
        // a las primeras N butacas (cubiertas por combo) las mando con precio 0,
        // porque lo que costaron ya está incluido en el precio fijo del combo
        // (ese precio se registra aparte, en la fila de entrada_combos)
        butacas: this.seleccion.butacas.map((b: any, i: number) => ({
          butacaId: b.butacaId,
          precio: i < this.butacasCubiertasPorCombo ? 0 : b.precio
        })),
        candy: this.candySeleccionado.map((p: any) => ({
          candyId: p.id,
          cantidad: p.cantidad,
          precioUnitario: p.precio
        })),
        combos: this.combosSeleccionados.map((c: any) => ({
          comboId: c.id,
          cantidad: c.cantidad,
          precioUnitario: c.precio
        }))
      });

      // ya se guardó la compra en la base, ahora armo el pdf con el QR para
      // que se descargue solo, tal como pide la consigna. Si esto fallara por
      // algún motivo, no quiero que tape el hecho de que la compra sí se hizo,
      // por eso va en su propio try/catch en vez de arriesgar el mensaje de éxito
      try {
        const datosTicket = await this.authService.obtenerDatosTicket(entrada.id);
        await generarEntradaPDF(datosTicket);
      } catch (errorPdf) {
        console.error('No se pudo generar el PDF de la entrada:', errorPdf);
      }

      if (usuario) {
        this.router.navigate(['/perfil']);
      } else {
        this.mensajeExito.set('¡Compra confirmada! Como invitado, guardá bien tu comprobante.');
        setTimeout(() => this.router.navigate(['/inicio']), 2000);
      }

    } catch (error: any) {
      console.error('Error al finalizar la compra:', error);
      this.mensajeError.set('No se pudo completar la compra: ' + (error.message || 'Puede que alguna butaca ya no esté disponible.'));
    } finally {
      this.procesando = false;
    }
  }

  volver() {
    // le mando de nuevo la selección de butacas (si no, CandyComponent la
    // pierde del todo al re-inicializarse) y lo que ya tenía elegido de
    // candy/combos, para no hacerte perder lo que ya habías puesto
    this.router.navigate(['/candy'], {
      state: {
        seleccion: this.seleccion,
        candyPrevio: this.candySeleccionado,
        combosPrevios: this.combosSeleccionados
      }
    });
  }
}
