import { Component, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { generarEntradaPDF } from '../../utilidades/generar-entrada-pdf';
import { faltanMasDe2Horas } from '../../utilidades/proxima-funcion';


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
  credito = signal<number>(0);
  historialEntradas = signal<any[]>([]);
  errorDescarga = signal<string | null>(null);
  mensajeCancelacion = signal<string | null>(null);
  cuponBienvenida = signal<any>(null);

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
          this.credito.set(usuario.credito || 0);
          this.cargarHistorial(usuario.id);
          this.cargarCuponBienvenida();
        }
    });
  }

  // solo tiene sentido mostrarlo si el usuario todavía no compró nada
  // (una vez que ya compró, ya no es "su primera compra")
  private async cargarCuponBienvenida() {
    try {
      const cupon = await this.authService.obtenerCuponBienvenida();
      this.cuponBienvenida.set(cupon);
    } catch (err) {
      console.error('Error al buscar el cupón de bienvenida:', err);
    }
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
        entradaId: e.id, // lo guardo para poder volver a generar el pdf, o cancelar, esta compra
        pelicula: e.funciones?.peliculas?.titulo ?? 'Película',
        imagen: e.funciones?.peliculas?.imagen ?? '',
        fecha: e.funciones?.dia ?? '',
        horario: e.funciones?.horario ?? '',
        estado: e.estado,
        total: e.total,
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

  // para volver a bajar el pdf de una compra vieja, sin tener que comprar de nuevo
  async descargarEntrada(entradaId: number) {
    try {
      this.errorDescarga.set(null);
      const datosTicket = await this.authService.obtenerDatosTicket(entradaId);
      await generarEntradaPDF(datosTicket);
    } catch (err) {
      console.error('No se pudo generar el PDF:', err);
      this.errorDescarga.set('No se pudo descargar la entrada. Probá de nuevo.');
    }
  }

  // solo se puede cancelar si no está cancelada ya, y si todavía faltan
  // 2 horas o más para la función (mismo chequeo que hace el servidor,
  // acá es solo para no mostrar el botón cuando ya no tiene sentido)
  puedeCancelar(item: any): boolean {
    return item.estado !== 'cancelada' && faltanMasDe2Horas(item.fecha, item.horario);
  }

  async cancelarCompra(item: any) {
    try {
      this.mensajeCancelacion.set(null);
      const nuevoCredito = await this.authService.cancelarCompra(item.entradaId, this.authService.usuarioActual().id);
      this.credito.set(nuevoCredito);
      this.historialEntradas.update(lista =>
        lista.map(i => i.entradaId === item.entradaId ? { ...i, estado: 'cancelada' } : i)
      );
      this.mensajeCancelacion.set(`✅ Compra cancelada. Se sumaron $${item.total} de crédito a tu cuenta.`);
    } catch (err: any) {
      this.mensajeCancelacion.set(`❌ ${err.message || 'No se pudo cancelar la compra.'}`);
    }
  }

  volverInicio() {
    this.router.navigate(['/inicio']);
  }
 }