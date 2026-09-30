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
  misAlertas = signal<any[]>([]); // filas {pelicula_id, notificada}

  // peliculas por las que hay que avisarle AHORA al usuario (ya salieron de
  // "proximamente" y todavia no se le mostró el aviso). Se van sacando de acá
  // a medida que las cierra
  avisosPendientes = signal<any[]>([]);

  constructor() {
  effect(() => {
    const usuario = this.authService.usuarioActual();
    if (usuario) {
      this.usuarioLogueado.set(true);
      this.nombreUsuario.set(usuario.nombre || usuario.email.split('@')[0].toUpperCase());
      // la carga de alertas + la revision de avisos se hacen juntas, desde
      // ngOnInit, para asegurarme de que las peliculas ya esten cargadas
      // antes de comparar (sino, revisarAvisosPendientes compara contra una
      // lista vacia y no encuentra nada)
    } else {
      this.usuarioLogueado.set(false);
      this.misAlertas.set([]);
    }
    });
  }

  async ngOnInit() {
    await this.cargarPeliculasDesdeDB();

    const usuario = this.authService.usuarioActual();
    if (usuario) {
      const alertas = await this.authService.obtenerMisAlertas(usuario.id);
      this.misAlertas.set(alertas);
      this.revisarAvisosPendientes(usuario.id);
    }
  }

  // como no tenemos backend propio, no hay forma de avisarle al usuario si no
  // tiene la app abierta (eso necesitaría un servidor que mande push). Lo que
  // sí podemos hacer es, cada vez que entra, fijarnos si alguna película de
  // sus alertas ya salió de "próximamente" y todavía no se lo avisamos
  private revisarAvisosPendientes(usuarioId: string) {
    const idsConAlerta = new Map(this.misAlertas().map(a => [a.pelicula_id, a.notificada]));
    const idsEnCartelera = new Set(this.peliculasCartelera().map(p => p.id));

    const pendientes = this.peliculas().filter(p =>
      idsConAlerta.has(p.id) && !idsConAlerta.get(p.id) && idsEnCartelera.has(p.id)
    );

    if (pendientes.length === 0) return;

    this.avisosPendientes.set(pendientes);

    // si el usuario dio permiso antes, además de el cartel en pantalla le
    // mandamos una notificación real del navegador
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      pendientes.forEach(p => {
        new Notification('🎬 RoxiMovie', { body: `¡Ya podés comprar entradas para "${p.titulo}"!` });
      });
    }

    pendientes.forEach(p => this.authService.marcarAlertaNotificada(usuarioId, p.id));
  }

  cerrarAviso(peliculaId: number) {
    this.avisosPendientes.update(lista => lista.filter(p => p.id !== peliculaId));
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

  tieneAlertaActiva(peliculaId: number): boolean {
    return this.misAlertas().some(a => a.pelicula_id === peliculaId);
  }

  async activarAlerta(peliculaId: number) {
  const usuario = this.authService.usuarioActual();
  if (!usuario) {
    this.router.navigate(['/login']);
    return;
  }

  // este es el momento natural para pedir el permiso: recien cuando el
  // usuario activamente pide que le avisen, no apenas entra a la pagina
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  await this.authService.activarAlertaEstreno(usuario.id, peliculaId);
  this.misAlertas.update(alertas => [...alertas, { pelicula_id: peliculaId, notificada: false }]);
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
