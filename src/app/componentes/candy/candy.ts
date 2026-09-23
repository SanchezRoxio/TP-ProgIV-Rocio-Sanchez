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

  async ngOnInit() {
    const navigation = history.state;
    if (navigation && navigation.seleccion) {
      this.seleccion = navigation.seleccion;
    }

    await this.cargarCandyDB();
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

  calcularTotal(): number {
    return this.productos().reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
  }

  continuarPago() {
    const seleccionados = this.productos().filter(p => p.cantidad > 0);
    this.router.navigate(['/pago'], {
      state: {
        seleccion: this.seleccion,
        candy: seleccionados
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
        candy: []
      }
    });
  }
}
