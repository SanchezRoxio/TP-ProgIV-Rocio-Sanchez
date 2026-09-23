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
  generoSeleccionado = signal<string>('TODOS');

  constructor() {
  effect(() => {
    const usuario = this.authService.usuarioActual();
    if (usuario) {
      this.usuarioLogueado.set(true);
      this.nombreUsuario.set(usuario.nombre || usuario.email.split('@')[0].toUpperCase());
    } else {
      this.usuarioLogueado.set(false);
    }
    });
  }

  async ngOnInit() {
    // cargar las películas desde la db
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

  // Top 3 películas
  topPeliculas = computed(() => {
    return this.peliculas().slice(0, 3);
  });

  seleccionarGenero(genero: string) {
    this.generoSeleccionado.set(genero);
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
