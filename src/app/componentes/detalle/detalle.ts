import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface Resena {
  usuario: string;
  estrellas: number;
  comentario: string;
  fecha: string;
}

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detalle.html',
  styleUrl: './detalle.css'
})
export class DetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  // obtenemos el ID de la película desde la URL
  peliculaId = this.route.snapshot.paramMap.get('id');
  pelicula = signal<any>(null);

  resenas = signal<Resena[]>([
    { usuario: 'Roxi M.', estrellas: 5, comentario: '¡Excelente animación y sonido retro!', fecha: '08/06/2026' },
    { usuario: 'Carlos P.', estrellas: 4, comentario: 'Muy buena trama, la recomiendo.', fecha: '09/06/2026' }
  ]);

  nuevaEstrellas = 5;
  nuevoComentario = '';

  async ngOnInit() {
    await this.cargarPeliculaDesdeDB();
  }

  async cargarPeliculaDesdeDB() {
      try {
        const peliculas = await this.authService.obtenerPeliculas();
        const encontrada = peliculas.find((p: any) => p.id.toString() === this.peliculaId);
        
        if (encontrada) {
          const funciones = await this.authService.obtenerFuncionesPorPelicula(encontrada.id);
          
          // Cargamos también las reseñas
          const listaResenas = await this.authService.obtenerResenasPorPelicula(encontrada.id);
          
          this.pelicula.set({
            ...encontrada,
            funciones: funciones
          });

          if (listaResenas.length > 0) {
            this.resenas.set(listaResenas);
          } else {
            this.resenas.set([]); // Si no hay reseñas, arranca vacía
          }

        } else {
          this.pelicula.set(peliculas[0] || null);
        }
      } catch (error) {
        console.error('Error al cargar el detalle de la película:', error);
      }
    }

  calcularPromedio(): string {
    const lista = this.resenas();
    if (lista.length === 0) return 'Sin calificación';
    const suma = lista.reduce((acc, r) => acc + r.estrellas, 0);
    return (suma / lista.length).toFixed(1);
  }

  async agregarResena() {
      if (!this.nuevoComentario.trim()) return;
      
      const usuarioLogueado = this.authService.usuarioActual();
      const nombreUsuario = usuarioLogueado?.nombre || usuarioLogueado?.email || 'Anónimo';

      const nueva = {
        pelicula_id: Number(this.peliculaId),
        usuario: nombreUsuario,
        estrellas: Number(this.nuevaEstrellas),
        comentario: this.nuevoComentario.trim(),
        fecha: new Date().toLocaleDateString()
      };

      try {
        // Guardamos en DB
        await this.authService.crearResena(nueva);
        const actualizadas = await this.authService.obtenerResenasPorPelicula(Number(this.peliculaId));// Recargamos las reseñas de la db
        this.resenas.set(actualizadas);
        this.nuevoComentario = '';
      } catch (error) {
        console.error('Error al guardar la reseña:', error);
        alert('No se pudo guardar la reseña.');
      }
    }

  volver() {
    this.router.navigate(['/inicio']);
  }
  
  // metodo para calcular la edad exacta en base a la fecha de nacimiento
  private calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  
  avisoRestriccion = signal<string | null>(null);// Señal para mostrar avisos o bloqueos visuales en la pantallita
    
  seleccionarFuncion(funcionId: number) { // Restricción de edad e invitados
    const peliculaActual = this.pelicula();
    const usuarioLogueado = this.authService.usuarioActual();
    
    const clasificacion = peliculaActual?.clasificacion || '';
    let edadMinima = 18; // por defecto asumimos restricción general 

    if (clasificacion.includes('13')) {
      edadMinima = 13;
    } else if (clasificacion.includes('ATP')) {
      edadMinima = 0;
    }
  
    if (!usuarioLogueado) {  // INVITADO: Pueden comprar, pero DEBEN ver el aviso
      this.avisoRestriccion.set('⚠️ AVISO: Los menores de edad deben asistir obligatoriamente acompañados por un adulto responsable.'); 
      // Los dejamos avanzar a la compra despues de que lean el aviso
      setTimeout(() => {
        this.router.navigate(['/butacas', funcionId]);
      }, 3500);
      return;
    }

    if (usuarioLogueado.fecha_nacimiento) {// USUARIO REGISTRADO: Validamos su edad 
      const edadUsuario = this.calcularEdad(usuarioLogueado.fecha_nacimiento);
     
      if (edadUsuario < 18 || (edadMinima > 0 && edadUsuario < edadMinima)) { // Si es menor de edad, NO PUEDE COMPRAR
        this.avisoRestriccion.set('❌ COMPRA DENEGADA: Los menores de edad no pueden realizar compras de entradas.');
        return;
      }
    } else {
      // si no tiene fecha cargada
      this.avisoRestriccion.set('❌ COMPRA DENEGADA: Se requiere fecha de nacimiento registrada para validar la compra.');
      return;
    }

    // Si cumple todo avanza normal
    this.avisoRestriccion.set(null);
    this.router.navigate(['/butacas', funcionId]);
  }
}