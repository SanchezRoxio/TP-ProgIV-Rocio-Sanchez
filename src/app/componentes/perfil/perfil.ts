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
    const entradas = await this.authService.obtenerMisEntradas(usuarioId);
    this.historialEntradas.set(entradas.map((e: any) => ({
      pelicula: e.funciones?.peliculas?.titulo ?? 'Película',
      fecha: e.funciones?.dia ?? '',
      sala: e.funciones?.salas?.nombre ?? '',
      asientos: (e.entrada_butacas || []).map((eb: any) => `${eb.butacas.fila}-${eb.butacas.numero}`)
    })));
    } catch (err) {
    console.error('Error al cargar historial de entradas:', err);
    this.historialEntradas.set([]);
    }
  }

  volverInicio() {
    this.router.navigate(['/inicio']);
  }
}