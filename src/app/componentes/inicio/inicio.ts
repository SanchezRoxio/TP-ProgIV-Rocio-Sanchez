import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminDirective } from '../../directives/admin.directive';
import { FiltroPelisPipe } from '../../pipes/filtro-pipe';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminDirective, FiltroPelisPipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class InicioComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  // estados de usuario
  usuarioLogueado = signal<boolean>(false);
  nombreUsuario = signal<string>('');

  // señal que contienee las películas reales de db
  peliculas = signal<any[]>([]);

  // Filtros
  filtroBusqueda = signal<string>('');
  generosSeleccionados = signal<string[]>([]); // vacío = "todos", sin filtro de genero aplicado
  misAlertas = signal<number[]>([]);


  constructor() {
  effect(() => {
    const usuario = this.authService.usuarioActual();
    if (usuario) {
      this.usuarioLogueado.set(true);
      this.nombreUsuario.set(usuario.nombre || usuario.email.split('@')[0].toUpperCase());
      this.authService.obtenerMisAlertas(usuario.id).then(ids => this.misAlertas.set(ids));
    } else {
      this.usuarioLogueado.set(false);
      this.misAlertas.set([]);
    }
    });
  }

  async ngOnInit() {
    // cargar las peliculas desde la db
    await this.cargarPeliculasDesdeDB();
  }

  async cargarPeliculasDesdeDB() {
    try {
      const data = await this.authService.obtenerPeliculas();
      this.peliculas.set(data || []);
    } catch (error) {
      console.error('Error al cargar las películas de Supabase:', error);
    }
  }

  // cntos dias faltan para el estreno (negativo si ya paso)
  private diasHastaEstreno(fechaEstreno: string): number {
    const hoy = new Date();
    const estreno = new Date(fechaEstreno);
    return (estreno.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  }

  // Más de 7 días para el estreno: solo alerta, no se puede comprar todavía
  proximamente = computed(() => {
    return this.peliculas().filter(p => p.fecha_estreno && this.diasHastaEstreno(p.fecha_estreno) > 7);
  });

  // Sin fecha de estreno, o a 7 días o menos (entró en preventa), o ya estrenada
  peliculasCartelera = computed(() => {
    return this.peliculas().filter(p => !p.fecha_estreno || this.diasHastaEstreno(p.fecha_estreno) <= 7);
  });

  // Top 3 películas
  topPeliculas = computed(() => {
    return [...this.peliculasCartelera()] //hago una copia del array antes de ordenar
      .sort((a, b) => (b.ventas ?? 0) - (a.ventas ?? 0)) //comparo los elementos - el ?? es por si las dudas, por si alguna esta en null
      //si la película B vendio más que la A, el resultado es +, entonces B se pone antes que A
      .slice(0, 3);
  }); //el sort reordena la lista que le mando, la pisa, entoes hacete una fotocopia de la lista, y ordená la fotocopia, no el original

  toggleGenero(genero: string) {
    // "TODOS" siempre limpia la selección entera, no se combina con el resto
    if (genero === 'TODOS') {
      this.generosSeleccionados.set([]);
      return;
    }

    this.generosSeleccionados.update(actuales => {
      // si ya estaba tildado, lo saco; si no estaba, lo agrego
      if (actuales.includes(genero)) {
        return actuales.filter(g => g !== genero);
      }
      return [...actuales, genero];
    });
  }

  async activarAlerta(peliculaId: number) {
  const usuario = this.authService.usuarioActual();
  if (!usuario) {
    this.router.navigate(['/login']);
    return;
  }
  await this.authService.activarAlertaEstreno(usuario.id, peliculaId);
  this.misAlertas.update(ids => [...ids, peliculaId]);
  }

  verDetalle(id: number) {
    this.router.navigate(['/detalle', id]);
  }

  cerrarSesion() {
    this.authService.cerrarSesion();
    this.usuarioLogueado.set(false);
    this.router.navigate(['/inicio']);
  }
}
