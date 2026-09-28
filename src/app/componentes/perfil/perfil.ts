import { Component, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class PerfilComponent {
  private router = inject(Router);

  // Señales para los datos del usuario real
  nombre = signal<string>('');
  apellido = signal<string>('');
  email = signal<string>('');
  rol = signal<string>('');
  
  // Datos adicionales si los guardaste en el registro
  fechaNacimiento = signal<string>('');
  tipoSangre = signal<string>('');
  colorOjos = signal<string>('');
  diasVacaciones = signal<number | string>('');

  puntos = signal<number>(150);
  historialEntradas = signal<any[]>([]);

  private authService = inject(AuthService);   // agregá este inject junto a los otros

  constructor() {
    effect(() => {
      const usuario = this.authService.usuarioActual();
        if (usuario) {
          this.nombre.set(usuario.nombre || 'Usuario');
          this.apellido.set(usuario.apellido || '');
          this.email.set(usuario.email || '');
          this.rol.set(usuario.rol || 'cliente');
          this.fechaNacimiento.set(usuario.fecha_nacimiento || 'No especificada');
          this.tipoSangre.set(usuario.tipo_sangre || 'No especificado');
          this.colorOjos.set(usuario.color_ojos || 'No especificado');
          this.diasVacaciones.set(usuario.dias_vacaciones || 0);
          this.cargarHistorial(usuario.id);
        }
    });
  }

private async cargarHistorial(usuarioId: string) {
  try {
    const [entradas, calificaciones] = await Promise.all([
      this.authService.obtenerMisEntradas(usuarioId),
      this.authService.obtenerMisCalificaciones(usuarioId)
    ]);

    const mapaCalificaciones = new Map<number, number>();
    calificaciones.forEach((c: any) => mapaCalificaciones.set(c.pelicula_id, c.estrellas));

    // entradas viene ordenado de más nueva a más vieja (obtenerMisEntradas hace
    // order by created_at desc), asi que si ya tengo la pelicula en el mapa
    // significa que ya guardé la compra más reciente de esa peli, y esta que
    // estoy viendo ahora es una repetida más vieja -> la salteo
    const peliculasVistas = new Map<number, any>();

    entradas.forEach((e: any) => {
      const peliculaId = e.funciones?.peliculas?.id ?? null;
      if (!peliculaId || peliculasVistas.has(peliculaId)) return;

      peliculasVistas.set(peliculaId, {
        peliculaId,
        pelicula: e.funciones?.peliculas?.titulo ?? 'Película',
        imagen: e.funciones?.peliculas?.imagen ?? '',
        fecha: e.funciones?.dia ?? '',
        sala: e.funciones?.salas?.nombre ?? '',
        asientos: (e.entrada_butacas || []).map((eb: any) => `${eb.butacas.fila}-${eb.butacas.numero}`),
        miCalificacion: mapaCalificaciones.get(peliculaId) ?? null
      });
    });

    this.historialEntradas.set(Array.from(peliculasVistas.values()));
  } catch (err) {
    console.error('Error al cargar historial de entradas:', err);
    this.historialEntradas.set([]);
  }
   }

  volverInicio() {
    this.router.navigate(['/inicio']);
  }
 }