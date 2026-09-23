import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  seccionActiva = signal<string>('peliculas');
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  peliculaForm!: FormGroup;
  candyForm!: FormGroup;
  salaForm!: FormGroup;

  candyList = signal<any[]>([]);
  editandoCandyId = signal<number | null>(null);

  ngOnInit() {
    this.inicializarFormularios();
    this.cargarCandy();
  }

  inicializarFormularios() {
    this.peliculaForm = this.fb.group({
      titulo: ['', Validators.required],
      imagen: ['', Validators.required],
      sinopsis: ['', Validators.required],
      duracion: [120, [Validators.required, Validators.min(1)]],
      clasificacion: ['ATP', Validators.required],
      generos: ['', Validators.required],
      funciones: this.fb.array([this.crearFuncion()])
    });

    this.candyForm = this.fb.group({
      nombre: ['', Validators.required],
      categoria: ['', Validators.required],
      imagen: ['', Validators.required],
      precio: [0, [Validators.required, Validators.min(0)]]
    });

    this.salaForm = this.fb.group({
      nombre: ['', Validators.required]
    });
  }

  // Cada fila = UNA función concreta (día + horario + formato + idioma)
  crearFuncion(): FormGroup {
    return this.fb.group({
      dia: ['Lunes', Validators.required],
      horario: ['18:00', Validators.required],
      formato: ['2D', Validators.required],
      idioma: ['castellano', Validators.required]
    });
  }

  get funciones(): FormArray {
    return this.peliculaForm.get('funciones') as FormArray;
  }

  agregarFuncion() {
    this.funciones.push(this.crearFuncion());
  }

  eliminarFuncion(index: number) {
    if (this.funciones.length > 1) {
      this.funciones.removeAt(index);
    }
  }

  cambiarSeccion(seccion: string) {
    this.seccionActiva.set(seccion);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  async guardarPelicula() {
    if (this.peliculaForm.invalid) {
      this.mensajeError.set('⚠️ Por favor completa todos los campos de la película.');
      this.mensajeExito.set(null);
      return;
    }

    const formValues = this.peliculaForm.value;

    try {
      this.mensajeError.set(null);
      this.mensajeExito.set('Procesando asignación automática de salas...');

      const nuevaPeli = {
        titulo: formValues.titulo,
        imagen: formValues.imagen,
        sinopsis: formValues.sinopsis,
        duracion: Number(formValues.duracion),
        clasificacion: formValues.clasificacion,
        generos: formValues.generos.split(',').map((g: string) => g.trim())
      };

      const peliCreadaArray = await this.authService.crearPelicula(nuevaPeli);
      const peliCreada = peliCreadaArray[0];

      for (const func of formValues.funciones) {
        await this.authService.programarFuncionConMargen(
          peliCreada.id,
          func.dia,
          func.horario,
          Number(formValues.duracion),
          func.formato,
          func.idioma
        );
      }

      this.mensajeExito.set('✅ ¡Película y funciones creadas con salas asignadas automáticamente!');
      this.peliculaForm.reset({ duracion: 120, clasificacion: 'ATP' });
      this.funciones.clear();
      this.funciones.push(this.crearFuncion());

    } catch (error: any) {
      console.error(error);
      this.mensajeError.set(`❌ Error: ${error.message || 'No se pudo programar la función.'}`);
      this.mensajeExito.set(null);
    }
  }

  async cargarCandy() {
    try {
      const data = await this.authService.obtenerCandy();
      this.candyList.set(data || []);
    } catch (error) {
      console.error('Error al cargar candy:', error);
    }
  }

  async guardarCandy() {
    if (this.candyForm.invalid) {
      this.mensajeError.set('⚠️ Completa los datos del producto del candy.');
      return;
    }

    try {
      const id = this.editandoCandyId();

      if (id) {
        await this.authService.actualizarCandy(id, this.candyForm.value);
        this.mensajeExito.set('🍿 ¡Producto actualizado con éxito!');
      } else {
        await this.authService.crearCandy(this.candyForm.value);
        this.mensajeExito.set('🍿 ¡Producto agregado al Candy Bar con éxito!');
      }

      this.mensajeError.set(null);
      this.candyForm.reset({ precio: 0 });
      this.editandoCandyId.set(null);
      await this.cargarCandy();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al guardar el producto.');
      this.mensajeExito.set(null);
    }
  }

  editarCandy(producto: any) {
    this.editandoCandyId.set(producto.id);
    this.candyForm.patchValue({
      nombre: producto.nombre,
      categoria: producto.categoria,
      imagen: producto.imagen,
      precio: producto.precio
    });
  }

  cancelarEdicionCandy() {
    this.editandoCandyId.set(null);
    this.candyForm.reset({ precio: 0 });
  }

  async borrarCandy(id: number) {
    if (!confirm('¿Seguro que querés borrar este producto?')) return;

    try {
      await this.authService.eliminarCandy(id);
      this.mensajeExito.set('🗑️ Producto borrado.');
      this.mensajeError.set(null);
      await this.cargarCandy();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al borrar el producto.');
    }
  }

  async guardarSala() {
    if (this.salaForm.invalid) {
      this.mensajeError.set('⚠️ Ponele un nombre a la sala.');
      return;
    }

    try {
      await this.authService.crearSala(this.salaForm.value.nombre);
      this.mensajeExito.set('🎬 ¡Sala creada! Las butacas se generaron automáticamente.');
      this.mensajeError.set(null);
      this.salaForm.reset();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al crear la sala.');
      this.mensajeExito.set(null);
    }
  }

  exportarPDF() {
    alert('📄 Exportando reporte de facturación a PDF...');
  }

  exportarExcel() {
    alert('📊 Exportando reporte de facturación a Excel...');
  }
}
