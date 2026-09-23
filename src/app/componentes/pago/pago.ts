import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  private preciosButaca: Record<string, number> = { general: 4000, discapacidad: 4000, vip: 6000 };

  seleccion: any = null;
  candySeleccionado: any[] = [];
  subtotalEntradas: number = 0;
  codigoCupon: string = '';
  descuentoAplicado: number = 0;
  usarCredito: boolean = false;
  creditoDisponible: number = 2500;
  procesando = false;

  ngOnInit() {
    const navigation = history.state;
    if (navigation && navigation.seleccion) {
      this.seleccion = navigation.seleccion;
    }
    if (navigation && navigation.candy) {
      this.candySeleccionado = navigation.candy;
    }

    if (this.seleccion) {
      this.subtotalEntradas = this.seleccion.butacas.reduce(
        (acc: number, b: any) => acc + (this.preciosButaca[b.tipo] ?? this.preciosButaca['general']),
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

  calcularTotal(): number {
    let total = (this.subtotalEntradas + this.getSubtotalCandy()) - this.descuentoAplicado;
    if (this.usarCredito) {
      total = Math.max(0, total - this.creditoDisponible);
    }
    return total;
  }

  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  aplicarCupon() {
    if (this.codigoCupon.toUpperCase() === 'BIENVENIDA20') {
      this.descuentoAplicado = (this.subtotalEntradas + this.getSubtotalCandy()) * 0.20;
      this.mensajeExito.set('¡Cupón de 20% aplicado con éxito!');
      this.mensajeError.set(null);
    } else {
      this.mensajeError.set('Cupón inválido o expirado.');
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

      await this.authService.finalizarCompra({
        usuarioId: usuario ? usuario.id : null,
        funcionId: this.seleccion.funcionId,
        total: this.calcularTotal(),
        butacas: this.seleccion.butacas.map((b: any) => ({
          butacaId: b.butacaId,
          precio: this.preciosButaca[b.tipo] ?? this.preciosButaca['general']
        })),
        candy: this.candySeleccionado.map((p: any) => ({
          candyId: p.id,
          cantidad: p.cantidad,
          precioUnitario: p.precio
        }))
      });

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
    this.router.navigate(['/candy']);
  }
}
