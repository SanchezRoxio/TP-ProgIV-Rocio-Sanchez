import { Component, signal, inject, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-entradas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entradas.html',
  styleUrl: './entradas.css'
})
export class EntradasComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);

  codigoManual = '';
  entrada = signal<any>(null);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  cargando = signal(false);

  private scanner: Html5Qrcode | null = null;
  private ultimoCodigoEscaneado = ''; // para no volver a buscar el mismo QR mil veces mientras sigue enfocado
  private camaraIniciada = false; // solo true si el start() realmente arrancó a escanear

  ngAfterViewInit() {
    // arranco la cámara recién acá, cuando el <div id="lector-qr"> ya está
    // renderizado en el DOM (en ngOnInit todavía podría no estarlo)
    this.scanner = new Html5Qrcode('lector-qr');
    this.scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (textoDecodificado: string) => this.onCodigoEscaneado(textoDecodificado),
        () => {} // esto se llama todo el tiempo mientras no encuentra un QR, lo ignoro
      )
      .then(() => {
        this.camaraIniciada = true;
      })
      .catch((err) => {
        // pasa, por ejemplo, si el dispositivo no tiene cámara, o si el
        // usuario le niega el permiso. Igual se puede seguir usando el
        // input manual, asi que no es un error que bloquee la pantalla
        console.error('No se pudo iniciar la cámara:', err);
        this.mensajeError.set('No se pudo acceder a la cámara. Podés escribir el código a mano.');
      });
  }

  ngOnDestroy() {
    // misma idea que el ngOnDestroy de butacas.ts con la suscripción de
    // Realtime: si no apago la cámara acá, se queda prendida en segundo plano.
    // Ojo: solo tiene sentido frenarla si realmente llegó a arrancar (si el
    // start() falló, como cuando no hay cámara, stop() tira una excepción
    // que corta la destrucción del componente y bloquea la navegación)
    if (this.scanner && this.camaraIniciada) {
      this.scanner.stop().catch(() => {});
    }
  }

  private onCodigoEscaneado(codigo: string) {
    if (codigo === this.ultimoCodigoEscaneado) return; // ya lo tengo mostrado, no lo vuelvo a buscar
    this.ultimoCodigoEscaneado = codigo;
    this.buscar(codigo);
  }

  async buscarCodigoManual() {
    if (!this.codigoManual.trim()) return;
    await this.buscar(this.codigoManual);
  }

  private async buscar(codigo: string) {
    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    try {
      const data = await this.authService.buscarEntradaPorCodigo(codigo);
      this.entrada.set(data);
    } catch (err: any) {
      this.entrada.set(null);
      this.mensajeError.set(err.message || 'No se pudo buscar la entrada.');
    } finally {
      this.cargando.set(false);
    }
  }

  async validarEntrada() {
    const entradaActual = this.entrada();
    if (!entradaActual) return;
    try {
      const usuario = this.authService.usuarioActual();
      await this.authService.validarEntrada(entradaActual.id, usuario?.id ?? null);
      this.mensajeExito.set('✅ Entrada validada. ¡Que disfrute la función!');
      this.mensajeError.set(null);
      this.entrada.update((e: any) => ({ ...e, validada: true }));
    } catch (err: any) {
      this.mensajeError.set(err.message);
    }
  }

  async entregarCandy() {
    const entradaActual = this.entrada();
    if (!entradaActual) return;
    try {
      const usuario = this.authService.usuarioActual();
      await this.authService.marcarCandyEntregado(entradaActual.id, usuario?.id ?? null);
      this.mensajeExito.set('🍿 Candy entregado.');
      this.mensajeError.set(null);
      this.entrada.update((e: any) => ({ ...e, candy_entregado: true }));
    } catch (err: any) {
      this.mensajeError.set(err.message);
    }
  }

  tieneCandyOCombos(): boolean {
    const e = this.entrada();
    if (!e) return false;
    return (e.entrada_candy?.length ?? 0) > 0 || (e.entrada_combos?.length ?? 0) > 0;
  }

  limpiar() {
    this.entrada.set(null);
    this.codigoManual = '';
    this.ultimoCodigoEscaneado = '';
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }
}
