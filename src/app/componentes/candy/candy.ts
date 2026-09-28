import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface ProductoCandy {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candy.html',
  styleUrl: './candy.css'
})
export class CandyComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  seleccion: any = null; // lo que armó ButacasComponent: { funcionId, butacas: [...] }
  productos = signal<ProductoCandy[]>([]);
  combos = signal<any[]>([]);

  async ngOnInit() {
    const navigation = history.state;
    if (navigation && navigation.seleccion) {
      this.seleccion = navigation.seleccion;
    }

    await this.cargarCandyDB();
    await this.cargarCombosDB();

    // si vengo de apretar "volver" en pago.ts, restauro lo que ya tenía elegido
    if (navigation && navigation.candyPrevio) {
      this.restaurarCantidades(this.productos, navigation.candyPrevio);
    }
    if (navigation && navigation.combosPrevios) {
      this.restaurarCantidades(this.combos, navigation.combosPrevios);
    }
  }

  // busca cada item de la lista (productos o combos) en lo que ya tenías
  // elegido antes de ir a pago, y le devuelve esa cantidad en vez de 0
  private restaurarCantidades(signalLista: any, previos: any[]) {
    signalLista.update((lista: any[]) =>
      lista.map(item => {
        const encontrado = previos.find((p: any) => p.id === item.id);
        return encontrado ? { ...item, cantidad: encontrado.cantidad } : item;
      })
    );
  }

  async cargarCandyDB() {
    try {
      const data = await this.authService.obtenerCandy();
      const prodsConCantidad = (data || []).map((p: any) => ({ ...p, cantidad: 0 }));
      this.productos.set(prodsConCantidad);
    } catch (err) {
      console.error('Error al cargar productos del candy:', err);
    }
  }

  async cargarCombosDB() {
    try {
      const data = await this.authService.obtenerCombos();
      // le agrego cantidad: 0 a cada combo, igual que a los productos sueltos,
      // para poder usar el mismo contador +/- en el template
      const combosConCantidad = (data || []).map((c: any) => ({ ...c, cantidad: 0 }));
      this.combos.set(combosConCantidad);
    } catch (err) {
      console.error('Error al cargar combos:', err);
    }
  }

  cambiarCantidad(id: number, delta: number) {
    this.productos.update(prods =>
      prods.map(p => {
        if (p.id === id) {
          const nuevaCantidad = Math.max(0, p.cantidad + delta);
          return { ...p, cantidad: nuevaCantidad };
        }
        return p;
      })
    );
  }

  // cuántos combos tengo elegidos en total, sumando todos los tipos de combo
  totalCombosSeleccionados(): number {
    return this.combos().reduce((acc, c) => acc + c.cantidad, 0);
  }

  // cada combo "cubre" la entrada de una butaca, así que no puedo elegir
  // más combos en total que butacas haya en la selección
  cambiarCantidadCombo(id: number, delta: number) {
    const totalButacas = this.seleccion?.butacas?.length ?? 0;

    this.combos.update(combos =>
      combos.map(c => {
        if (c.id !== id) return c;

        const nuevaCantidad = c.cantidad + delta;
        if (nuevaCantidad < 0) return c;

        const totalConEsteCambio = this.totalCombosSeleccionados() - c.cantidad + nuevaCantidad;
        if (totalConEsteCambio > totalButacas) return c; // no hay más butacas libres para cubrir

        return { ...c, cantidad: nuevaCantidad };
      })
    );
  }

  calcularTotalCombos(): number {
    return this.combos().reduce((acc, c) => acc + (c.precio * c.cantidad), 0);
  }

  calcularTotal(): number {
    return this.productos().reduce((acc, p) => acc + (p.precio * p.cantidad), 0) + this.calcularTotalCombos();
  }

  continuarPago() {
    const seleccionados = this.productos().filter(p => p.cantidad > 0);
    const combosSeleccionados = this.combos().filter(c => c.cantidad > 0);
    this.router.navigate(['/pago'], {
      state: {
        seleccion: this.seleccion,
        candy: seleccionados,
        combos: combosSeleccionados,
        butacasCubiertasPorCombo: this.totalCombosSeleccionados()
      }
    });
  }

  volver() {
    this.router.navigate(['/inicio']);
  }

  saltarCandy() {
    this.router.navigate(['/pago'], {
      state: {
        seleccion: this.seleccion,
        candy: [],
        combos: []
      }
    });
  }
}
