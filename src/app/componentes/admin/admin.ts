import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { AuthService } from '../../services/auth.service';
import { claveDia, claveSemana, claveMes } from '../../utilidades/agrupar-fechas';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  seccionActiva = signal<string>('peliculas');
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  peliculaForm!: FormGroup;
  candyForm!: FormGroup;
  salaForm!: FormGroup;
  comboForm!: FormGroup;
  cuponForm!: FormGroup;
  funcionEditForm!: FormGroup;
  recompensaForm!: FormGroup;

  // funciones ya cargadas de cada pelicula, por pelicula_id -> lista.
  // se van completando de a una a medida que abrís el desplegable de cada pelicula
  funcionesPorPelicula = signal<Record<number, any[]>>({});
  peliculaExpandidaId = signal<number | null>(null);
  editandoFuncionId = signal<number | null>(null);
  confirmandoBorrarFuncionId = signal<number | null>(null);

  peliculasList = signal<any[]>([]);
  editandoPeliculaId = signal<number | null>(null);
  confirmandoBorrarPeliculaId = signal<number | null>(null);

  candyList = signal<any[]>([]);
  editandoCandyId = signal<number | null>(null);
  confirmandoBorrarCandyId = signal<number | null>(null);

  salasList = signal<any[]>([]);
  editandoSalaId = signal<number | null>(null);
  confirmandoBorrarSalaId = signal<number | null>(null);

  combosList = signal<any[]>([]);
  // guardo acá cuánto de cada producto de candy va en el combo que estoy armando,
  // por candy_id -> cantidad. No lo meto en el comboForm porque la lista de candy
  // es dinámica (viene de la db), armar un FormGroup por cada producto sería mucho lío
  cantidadesCombo = signal<Record<number, number>>({});
  editandoComboId = signal<number | null>(null);
  confirmandoBorrarComboId = signal<number | null>(null);

  // lista de logs de auditoria para la pestaña de reportes (solo lectura)
  logsList = signal<any[]>([]);

  cuponesList = signal<any[]>([]);
  editandoCuponId = signal<number | null>(null);
  confirmandoBorrarCuponId = signal<number | null>(null);

  // gestion de empleados: busco un usuario ya registrado por email y le cambio el rol
  emailBusquedaEmpleado = '';
  empleadosList = signal<any[]>([]);
  usuarioEncontrado = signal<any>(null);

  // REPORTES
  facturacionPorDia = signal<{ dia: string; total: number; cantidad: number }[]>([]);
  vistaPeriodo = signal<'semana' | 'mes'>('semana');
  peliculasMasVistas = signal<{ nombre: string; cantidad: number }[]>([]);
  candyMasVendido = signal<{ nombre: string; cantidad: number }[]>([]);
  private entradasReporte: any[] = []; // cache crudo, para no volver a pedirle a la db cuando cambiás semana/mes

  // recompensas del programa de puntos
  recompensasList = signal<any[]>([]);
  editandoRecompensaId = signal<number | null>(null);
  confirmandoBorrarRecompensaId = signal<number | null>(null);

  ngOnInit() {
    this.inicializarFormularios();
    this.cargarPeliculas();
    this.cargarCandy();
    this.cargarSalas();
    this.cargarCombos();
    this.cargarLogs();
    this.cargarCupones();
    this.cargarEmpleados();
    this.cargarReportes();
    this.cargarRecompensas();
  }

  async cargarLogs() {
    try {
      const data = await this.authService.obtenerLogs();
      this.logsList.set(data || []);
    } catch (error) {
      console.error('Error al cargar los logs:', error);
    }
  }

  inicializarFormularios() {
    this.peliculaForm = this.fb.group({
      titulo: ['', Validators.required],
      imagen: ['', Validators.required],
      sinopsis: ['', Validators.required],
      duracion: [120, [Validators.required, Validators.min(1)]],
      clasificacion: ['ATP', Validators.required],
      generos: ['', Validators.required],
      fecha_estreno: [''],
      precio_preventa: [''],
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

    this.comboForm = this.fb.group({
      nombre: ['', Validators.required],
      precio: [0, [Validators.required, Validators.min(0)]]
    });

    this.cuponForm = this.fb.group({
      codigo: ['', Validators.required],
      descuento_porcentaje: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      fecha_vencimiento: [''], // opcional: si queda vacio, el cupon no vence nunca
      solo_mayores_50: [false], // si esta en true, el cupon solo lo pueden usar usuarios logueados de 50 años o mas
      solo_primera_compra: [false] // si esta en true, solo lo puede usar un usuario logueado que nunca haya comprado antes
    });

    this.funcionEditForm = this.fb.group({
      dia: ['Lunes', Validators.required],
      horario: ['18:00', Validators.required],
      formato: ['2D', Validators.required],
      idioma: ['castellano', Validators.required]
    });

    this.recompensaForm = this.fb.group({
      nombre: ['', Validators.required],
      puntos_costo: [500, [Validators.required, Validators.min(1)]],
      valor_monetario: [0, [Validators.required, Validators.min(1)]]
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

  async cargarPeliculas() {
    // traigo todas las peliculas para el listado del admin, para poder editarlas/borrarlas
    try {
      const data = await this.authService.obtenerPeliculas();
      this.peliculasList.set(data || []);
    } catch (error) {
      console.error('Error al cargar películas:', error);
    }
  }

  async guardarPelicula() {
    if (this.peliculaForm.invalid) {
      this.mensajeError.set('⚠️ Por favor completa todos los campos de la película.');
      this.mensajeExito.set(null);
      return;
    }

    const formValues = this.peliculaForm.value;
    const id = this.editandoPeliculaId();

    // estos son los datos que siempre se guardan, tanto al crear como al editar
    const datosPeli = {
      titulo: formValues.titulo,
      imagen: formValues.imagen,
      sinopsis: formValues.sinopsis,
      duracion: Number(formValues.duracion),
      clasificacion: formValues.clasificacion,
      generos: formValues.generos.split(',').map((g: string) => g.trim()),
      fecha_estreno: formValues.fecha_estreno || null,
      precio_preventa: formValues.precio_preventa ? Number(formValues.precio_preventa) : null
    };

    try {
      this.mensajeError.set(null);
      const usuario = this.authService.usuarioActual();

      if (id) {
        // busco la pelicula original en la lista ya cargada, para comparar
        // el precio_preventa de antes contra el nuevo y saber si cambio
        const peliOriginal = this.peliculasList().find(p => p.id === id);

        // si estoy editando, solo actualizo los datos de la pelicula, no toco las funciones
        // (editar el horario de una funcion ya creada queda para otro dia, es mas delicado)
        await this.authService.actualizarPelicula(id, datosPeli);
        this.mensajeExito.set('✅ ¡Película actualizada!');

        if (peliOriginal && peliOriginal.precio_preventa !== datosPeli.precio_preventa) {
          await this.authService.registrarLog(
            usuario?.id ?? null,
            'Modificó precio',
            `Cambió el precio de preventa de "${datosPeli.titulo}" de $${peliOriginal.precio_preventa ?? 0} a $${datosPeli.precio_preventa ?? 0}`
          );
        }
      } else {
        // si estoy creando, ademas de la pelicula, programo las funciones que cargue en el form
        this.mensajeExito.set('Procesando asignación automática de salas...');
        const peliCreadaArray = await this.authService.crearPelicula(datosPeli);
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
          // un log por cada funcion creada, asi queda registrado dia y horario exacto
          await this.authService.registrarLog(
            usuario?.id ?? null,
            'Creó función',
            `${datosPeli.titulo} — ${func.dia} ${func.horario} (${func.formato}, ${func.idioma})`
          );
        }
        this.mensajeExito.set('✅ ¡Película y funciones creadas con salas asignadas automáticamente!');
      }

      // el listado de logs recien se actualiza si estas parado en esa pestaña,
      // pero lo recargo igual para que ya este fresco cuando entres
      await this.cargarLogs();

      this.peliculaForm.reset({ duracion: 120, clasificacion: 'ATP' });
      this.funciones.clear();
      this.funciones.push(this.crearFuncion());
      this.editandoPeliculaId.set(null);
      await this.cargarPeliculas();

    } catch (error: any) {
      console.error(error);
      this.mensajeError.set(`❌ Error: ${error.message || 'No se pudo guardar la película.'}`);
      this.mensajeExito.set(null);
    }
  }

  editarPelicula(pelicula: any) {
    this.editandoPeliculaId.set(pelicula.id);
    // pelicula.generos viene como array desde supabase, pero el input del form
    // espera un texto separado por comas, por eso lo uno con join acá
    this.peliculaForm.patchValue({
      titulo: pelicula.titulo,
      imagen: pelicula.imagen,
      sinopsis: pelicula.sinopsis,
      duracion: pelicula.duracion,
      clasificacion: pelicula.clasificacion,
      generos: (pelicula.generos || []).join(', '),
      fecha_estreno: pelicula.fecha_estreno || '',
      precio_preventa: pelicula.precio_preventa || ''
    });
  }

  cancelarEdicionPelicula() {
    this.editandoPeliculaId.set(null);
    this.peliculaForm.reset({ duracion: 120, clasificacion: 'ATP' });
    this.funciones.clear();
    this.funciones.push(this.crearFuncion());
  }

  pedirConfirmacionBorrarPelicula(id: number) {
    this.confirmandoBorrarPeliculaId.set(id);
  }

  cancelarBorrarPelicula() {
    this.confirmandoBorrarPeliculaId.set(null);
  }

  async borrarPelicula(id: number) {
    try {
      await this.authService.eliminarPelicula(id);
      this.confirmandoBorrarPeliculaId.set(null);
      this.mensajeExito.set('🗑️ Película borrada.');
      this.mensajeError.set(null);
      await this.cargarPeliculas();
    } catch (error: any) {
      // si tiene funciones/entradas asociadas, postgres rechaza el borrado, por eso este mensaje generico
      this.mensajeError.set('❌ No se pudo borrar: probablemente tiene funciones o entradas vendidas asociadas.');
      this.mensajeExito.set(null);
    }
  }

  // FUNCIONES YA CARGADAS DE CADA PELICULA (editar/borrar despues de creadas)

  async toggleFunciones(peliculaId: number) {
    if (this.peliculaExpandidaId() === peliculaId) {
      this.peliculaExpandidaId.set(null);
      return;
    }
    this.peliculaExpandidaId.set(peliculaId);
    this.editandoFuncionId.set(null);

    // solo la pido a la db la primera vez que se abre esta pelicula, despues la reuso
    if (!this.funcionesPorPelicula()[peliculaId]) {
      await this.cargarFuncionesDePelicula(peliculaId);
    }
  }

  async cargarFuncionesDePelicula(peliculaId: number) {
    try {
      const data = await this.authService.obtenerFuncionesPorPelicula(peliculaId);
      this.funcionesPorPelicula.update(actual => ({ ...actual, [peliculaId]: data }));
    } catch (error) {
      console.error('Error al cargar funciones:', error);
    }
  }

  editarFuncionExistente(funcion: any) {
    this.editandoFuncionId.set(funcion.id);
    this.funcionEditForm.patchValue({
      dia: funcion.dia,
      horario: funcion.horario,
      formato: funcion.formato,
      idioma: funcion.idioma
    });
  }

  cancelarEdicionFuncion() {
    this.editandoFuncionId.set(null);
  }

  async guardarEdicionFuncion(peliculaId: number) {
    if (this.funcionEditForm.invalid) {
      this.mensajeError.set('⚠️ Completa día y horario de la función.');
      return;
    }

    const id = this.editandoFuncionId();
    if (!id) return;

    // mantengo la duracion que la funcion ya tenia, esto solo edita horario/formato/idioma
    const funcionOriginal = (this.funcionesPorPelicula()[peliculaId] || []).find(f => f.id === id);

    try {
      const usuario = this.authService.usuarioActual();
      await this.authService.actualizarFuncion(id, {
        ...this.funcionEditForm.value,
        duracion: funcionOriginal?.duracion ?? 120
      });
      await this.authService.registrarLog(
        usuario?.id ?? null,
        'Modificó función',
        `Función de "${this.peliculasList().find(p => p.id === peliculaId)?.titulo}" → ${this.funcionEditForm.value.dia} ${this.funcionEditForm.value.horario}`
      );

      this.mensajeExito.set('✅ ¡Función actualizada!');
      this.mensajeError.set(null);
      this.editandoFuncionId.set(null);
      await this.cargarFuncionesDePelicula(peliculaId);
      await this.cargarLogs();
    } catch (error: any) {
      this.mensajeError.set(`❌ ${error.message || 'No se pudo actualizar la función.'}`);
      this.mensajeExito.set(null);
    }
  }

  pedirConfirmacionBorrarFuncion(id: number) {
    this.confirmandoBorrarFuncionId.set(id);
  }

  cancelarBorrarFuncion() {
    this.confirmandoBorrarFuncionId.set(null);
  }

  async borrarFuncionExistente(id: number, peliculaId: number) {
    try {
      await this.authService.eliminarFuncion(id);
      this.confirmandoBorrarFuncionId.set(null);
      this.mensajeExito.set('🗑️ Función borrada.');
      this.mensajeError.set(null);
      await this.cargarFuncionesDePelicula(peliculaId);
    } catch (error: any) {
      this.mensajeError.set('❌ No se pudo borrar: probablemente ya tiene entradas vendidas.');
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
      const usuario = this.authService.usuarioActual();

      if (id) {
        // busco el producto original para comparar precios y loguear el cambio
        const candyOriginal = this.candyList().find(c => c.id === id);

        await this.authService.actualizarCandy(id, this.candyForm.value);
        this.mensajeExito.set('🍿 ¡Producto actualizado con éxito!');

        if (candyOriginal && candyOriginal.precio !== this.candyForm.value.precio) {
          await this.authService.registrarLog(
            usuario?.id ?? null,
            'Modificó precio',
            `Cambió el precio de "${this.candyForm.value.nombre}" de $${candyOriginal.precio} a $${this.candyForm.value.precio}`
          );
        }
      } else {
        await this.authService.crearCandy(this.candyForm.value);
        this.mensajeExito.set('🍿 ¡Producto agregado al Candy Bar con éxito!');
      }

      this.mensajeError.set(null);
      this.candyForm.reset({ precio: 0 });
      this.editandoCandyId.set(null);
      await this.cargarCandy();
      await this.cargarLogs();
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

  pedirConfirmacionBorrarCandy(id: number) {
    this.confirmandoBorrarCandyId.set(id);
  }

  cancelarBorrarCandy() {
    this.confirmandoBorrarCandyId.set(null);
  }

  async borrarCandy(id: number) {
    try {
      await this.authService.eliminarCandy(id);
      this.mensajeExito.set('🗑️ Producto borrado.');
      this.mensajeError.set(null);
      this.confirmandoBorrarCandyId.set(null);
      await this.cargarCandy();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al borrar el producto.');
    }
  }

  async cargarSalas() {
    try {
      const data = await this.authService.obtenerSalas();
      this.salasList.set(data || []);
    } catch (error) {
      console.error('Error al cargar salas:', error);
    }
  }

  async guardarSala() {
    if (this.salaForm.invalid) {
      this.mensajeError.set('⚠️ Ponele un nombre a la sala.');
      return;
    }

    try {
      const id = this.editandoSalaId();

      if (id) {
        await this.authService.actualizarSala(id, this.salaForm.value.nombre);
        this.mensajeExito.set('🎬 ¡Sala renombrada!');
      } else {
        await this.authService.crearSala(this.salaForm.value.nombre);
        this.mensajeExito.set('🎬 ¡Sala creada! Las butacas se generaron automáticamente.');
      }

      this.mensajeError.set(null);
      this.salaForm.reset();
      this.editandoSalaId.set(null);
      await this.cargarSalas();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al guardar la sala.');
      this.mensajeExito.set(null);
    }
  }

  editarSala(sala: any) {
    this.editandoSalaId.set(sala.id);
    this.salaForm.patchValue({ nombre: sala.nombre });
  }

  cancelarEdicionSala() {
    this.editandoSalaId.set(null);
    this.salaForm.reset();
  }

  pedirConfirmacionBorrarSala(id: number) {
    this.confirmandoBorrarSalaId.set(id);
  }

  cancelarBorrarSala() {
    this.confirmandoBorrarSalaId.set(null);
  }

  async borrarSala(id: number) {
    try {
      await this.authService.eliminarSala(id);
      this.confirmandoBorrarSalaId.set(null);
      this.mensajeExito.set('🗑️ Sala borrada.');
      this.mensajeError.set(null);
      await this.cargarSalas();
    } catch (error: any) {
      this.mensajeError.set('❌ No se pudo borrar: seguramente tiene funciones programadas en esa sala.');
      this.mensajeExito.set(null);
    }
  }

  async cargarCombos() {
    try {
      const data = await this.authService.obtenerCombos();
      this.combosList.set(data || []);
    } catch (error) {
      console.error('Error al cargar combos:', error);
    }
  }

  // se llama desde el input de cantidad de cada producto, en el form de crear combo
  cambiarCantidadCombo(candyId: number, valor: string) {
    const cantidad = Number(valor) || 0;
    this.cantidadesCombo.update(actual => ({ ...actual, [candyId]: cantidad }));
  }

  async guardarCombo() {
    if (this.comboForm.invalid) {
      this.mensajeError.set('⚠️ Completa nombre y precio del combo.');
      return;
    }

    // de todo lo que cargó en cantidadesCombo, solo me quedo con lo que sea > 0
    // (el resto son productos que dejó en 0, o sea que no van en este combo)
    const items = Object.entries(this.cantidadesCombo())
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([candyId, cantidad]) => ({ candyId: Number(candyId), cantidad }));

    if (items.length === 0) {
      this.mensajeError.set('⚠️ Elegí al menos un producto para el combo.');
      return;
    }

    try {
      const id = this.editandoComboId();

      if (id) {
        await this.authService.actualizarCombo(id, this.comboForm.value.nombre, Number(this.comboForm.value.precio), items);
        this.mensajeExito.set('🎉 ¡Combo actualizado!');
      } else {
        await this.authService.crearCombo(this.comboForm.value.nombre, Number(this.comboForm.value.precio), items);
        this.mensajeExito.set('🎉 ¡Combo creado!');
      }

      this.mensajeError.set(null);
      this.comboForm.reset({ precio: 0 });
      this.cantidadesCombo.set({});
      this.editandoComboId.set(null);
      await this.cargarCombos();
    } catch (error: any) {
      this.mensajeError.set(`❌ Error al guardar el combo.`);
      this.mensajeExito.set(null);
    }
  }

  editarCombo(combo: any) {
    this.editandoComboId.set(combo.id);
    this.comboForm.patchValue({ nombre: combo.nombre, precio: combo.precio });
    // combo.combo_items trae cada item con su candy anidado (candy.id), arranco
    // el mapa de cantidades con lo que el combo ya tenia cargado
    const cantidadesIniciales: Record<number, number> = {};
    (combo.combo_items || []).forEach((item: any) => {
      cantidadesIniciales[item.candy.id] = item.cantidad;
    });
    this.cantidadesCombo.set(cantidadesIniciales);
  }

  cancelarEdicionCombo() {
    this.editandoComboId.set(null);
    this.comboForm.reset({ precio: 0 });
    this.cantidadesCombo.set({});
  }

  pedirConfirmacionBorrarCombo(id: number) {
    this.confirmandoBorrarComboId.set(id);
  }

  cancelarBorrarCombo() {
    this.confirmandoBorrarComboId.set(null);
  }

  async borrarCombo(id: number) {
    try {
      await this.authService.eliminarCombo(id);
      this.confirmandoBorrarComboId.set(null);
      this.mensajeExito.set('🗑️ Combo borrado.');
      this.mensajeError.set(null);
      await this.cargarCombos();
    } catch (error: any) {
      this.mensajeError.set('❌ No se pudo borrar: probablemente ya fue comprado en alguna entrada.');
      this.mensajeExito.set(null);
    }
  }

  async cargarCupones() {
    try {
      const data = await this.authService.obtenerCupones();
      this.cuponesList.set(data || []);
    } catch (error) {
      console.error('Error al cargar cupones:', error);
    }
  }

  async guardarCupon() {
    if (this.cuponForm.invalid) {
      this.mensajeError.set('⚠️ Completa código y porcentaje de descuento del cupón.');
      return;
    }

    const formValues = this.cuponForm.value;
    const datosCupon = {
      codigo: formValues.codigo,
      descuento_porcentaje: Number(formValues.descuento_porcentaje),
      fecha_vencimiento: formValues.fecha_vencimiento || null,
      solo_mayores_50: !!formValues.solo_mayores_50,
      solo_primera_compra: !!formValues.solo_primera_compra
    };

    try {
      const id = this.editandoCuponId();
      const usuario = this.authService.usuarioActual();

      if (id) {
        // al editar mantengo el estado de "activo" que ya tenia (no se toca desde este form,
        // se maneja aparte con el boton activar/desactivar de la lista)
        const cuponOriginal = this.cuponesList().find(c => c.id === id);
        await this.authService.actualizarCupon(id, { ...datosCupon, activo: cuponOriginal?.activo ?? true });
        await this.authService.registrarLog(usuario?.id ?? null, 'Modificó cupón', `Editó el cupón "${datosCupon.codigo}" (${datosCupon.descuento_porcentaje}% de descuento)`);
        this.mensajeExito.set('🎟️ ¡Cupón actualizado!');
      } else {
        await this.authService.crearCupon(datosCupon);
        await this.authService.registrarLog(usuario?.id ?? null, 'Creó cupón', `Creó el cupón "${datosCupon.codigo}" (${datosCupon.descuento_porcentaje}% de descuento)`);
        this.mensajeExito.set('🎟️ ¡Cupón creado!');
      }

      this.mensajeError.set(null);
      this.cuponForm.reset({ descuento_porcentaje: 10, solo_mayores_50: false, solo_primera_compra: false });
      this.editandoCuponId.set(null);
      await this.cargarCupones();
      await this.cargarLogs();
    } catch (error: any) {
      // el codigo es unique en la db, asi que si repetis uno ya usado, salta este error
      this.mensajeError.set('❌ Error al guardar el cupón (¿el código ya existe?).');
      this.mensajeExito.set(null);
    }
  }

  editarCupon(cupon: any) {
    this.editandoCuponId.set(cupon.id);
    this.cuponForm.patchValue({
      codigo: cupon.codigo,
      descuento_porcentaje: cupon.descuento_porcentaje,
      fecha_vencimiento: cupon.fecha_vencimiento || '',
      solo_mayores_50: cupon.solo_mayores_50 || false,
      solo_primera_compra: cupon.solo_primera_compra || false
    });
  }

  cancelarEdicionCupon() {
    this.editandoCuponId.set(null);
    this.cuponForm.reset({ descuento_porcentaje: 10, solo_mayores_50: false, solo_primera_compra: false });
  }

  // en vez de borrarlo directamente, lo mas comun es desactivarlo:
  // asi las compras viejas que ya lo usaron quedan intactas en el historial
  async toggleActivoCupon(cupon: any) {
    try {
      const usuario = this.authService.usuarioActual();
      await this.authService.actualizarCupon(cupon.id, {
        codigo: cupon.codigo,
        descuento_porcentaje: cupon.descuento_porcentaje,
        fecha_vencimiento: cupon.fecha_vencimiento || null,
        solo_mayores_50: cupon.solo_mayores_50 || false,
        solo_primera_compra: cupon.solo_primera_compra || false,
        activo: !cupon.activo
      });
      await this.authService.registrarLog(
        usuario?.id ?? null,
        cupon.activo ? 'Desactivó cupón' : 'Activó cupón',
        `Cupón "${cupon.codigo}"`
      );
      await this.cargarCupones();
      await this.cargarLogs();
    } catch (error) {
      this.mensajeError.set('❌ No se pudo cambiar el estado del cupón.');
    }
  }

  pedirConfirmacionBorrarCupon(id: number) {
    this.confirmandoBorrarCuponId.set(id);
  }

  cancelarBorrarCupon() {
    this.confirmandoBorrarCuponId.set(null);
  }

  async borrarCupon(id: number) {
    try {
      await this.authService.eliminarCupon(id);
      this.confirmandoBorrarCuponId.set(null);
      this.mensajeExito.set('🗑️ Cupón borrado.');
      this.mensajeError.set(null);
      await this.cargarCupones();
    } catch (error: any) {
      this.mensajeError.set('❌ No se pudo borrar: probablemente ya fue usado en alguna compra.');
      this.mensajeExito.set(null);
    }
  }

  // GESTION DE EMPLEADOS

  async cargarEmpleados() {
    try {
      const data = await this.authService.obtenerEmpleados();
      this.empleadosList.set(data || []);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    }
  }

  async buscarUsuarioParaEmpleado() {
    if (!this.emailBusquedaEmpleado.trim()) return;
    try {
      this.mensajeError.set(null);
      const usuario = await this.authService.buscarUsuarioPorEmail(this.emailBusquedaEmpleado);
      if (!usuario) {
        this.usuarioEncontrado.set(null);
        this.mensajeError.set('⚠️ No hay ningún usuario registrado con ese email.');
        return;
      }
      this.usuarioEncontrado.set(usuario);
    } catch (error) {
      this.mensajeError.set('❌ Error al buscar el usuario.');
    }
  }

  async hacerEmpleado(usuario: any) {
    try {
      const usuarioActual = this.authService.usuarioActual();
      await this.authService.cambiarRolUsuario(usuario.id, 'empleado');
      await this.authService.registrarLog(usuarioActual?.id ?? null, 'Asignó rol empleado', `A ${usuario.email}`);
      this.mensajeExito.set(`✅ ${usuario.email} ahora es empleado.`);
      this.mensajeError.set(null);
      this.usuarioEncontrado.set(null);
      this.emailBusquedaEmpleado = '';
      await this.cargarEmpleados();
      await this.cargarLogs();
    } catch (error) {
      this.mensajeError.set('❌ No se pudo asignar el rol.');
    }
  }

  // en vez de borrar el usuario, simplemente le devuelvo el rol de cliente
  async quitarEmpleado(usuario: any) {
    try {
      const usuarioActual = this.authService.usuarioActual();
      await this.authService.cambiarRolUsuario(usuario.id, 'cliente');
      await this.authService.registrarLog(usuarioActual?.id ?? null, 'Quitó rol empleado', `A ${usuario.email}`);
      this.mensajeExito.set(`🗑️ ${usuario.email} ya no es empleado.`);
      this.mensajeError.set(null);
      await this.cargarEmpleados();
      await this.cargarLogs();
    } catch (error) {
      this.mensajeError.set('❌ No se pudo quitar el rol.');
    }
  }

  async cargarReportes() {
    try {
      const [entradas, candy] = await Promise.all([
        this.authService.obtenerReporteEntradas(),
        this.authService.obtenerReporteCandy()
      ]);

      this.entradasReporte = entradas;
      this.recalcularFacturacionPorDia();
      this.recalcularPeliculasMasVistas();

      const porCandy = new Map<string, number>();
      candy.forEach((c: any) => {
        const nombre = c.candy?.nombre ?? 'Producto eliminado';
        porCandy.set(nombre, (porCandy.get(nombre) ?? 0) + c.cantidad);
      });
      this.candyMasVendido.set(
        Array.from(porCandy.entries())
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
      );
    } catch (error) {
      console.error('Error al cargar reportes:', error);
    }
  }

  private recalcularFacturacionPorDia() {
    const porDia = new Map<string, { total: number; cantidad: number }>();
    this.entradasReporte.forEach(e => {
      const dia = claveDia(new Date(e.created_at));
      const actual = porDia.get(dia) ?? { total: 0, cantidad: 0 };
      actual.total += e.total;
      actual.cantidad += 1;
      porDia.set(dia, actual);
    });

    this.facturacionPorDia.set(
      Array.from(porDia.entries())
        .map(([dia, datos]) => ({ dia, ...datos }))
        .sort((a, b) => b.dia.localeCompare(a.dia)) // el dia más reciente primero
    );
  }

  // ranking de peliculas segun cuantas entradas se vendieron de cada una,
  // pero solo contando la semana o el mes ACTUAL (no todo el historico junto)
  private recalcularPeliculasMasVistas() {
    const armarClave = this.vistaPeriodo() === 'semana' ? claveSemana : claveMes;
    const clavePeriodoActual = armarClave(new Date());

    const porPelicula = new Map<string, number>();
    this.entradasReporte
      .filter(e => armarClave(new Date(e.created_at)) === clavePeriodoActual)
      .forEach(e => {
        const titulo = e.funciones?.peliculas?.titulo ?? 'Película eliminada';
        porPelicula.set(titulo, (porPelicula.get(titulo) ?? 0) + 1);
      });

    this.peliculasMasVistas.set(
      Array.from(porPelicula.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
    );
  }

  cambiarVistaPeriodo(periodo: 'semana' | 'mes') {
    this.vistaPeriodo.set(periodo);
    this.recalcularPeliculasMasVistas();
  }

  // le sirven al template para calcular el ancho de cada barra como
  // porcentaje del valor más alto (nunca 0, para no dividir por cero)
  maxFacturacionDia(): number {
    return Math.max(1, ...this.facturacionPorDia().map(f => f.total));
  }

  maxPeliculasVistas(): number {
    return Math.max(1, ...this.peliculasMasVistas().map(p => p.cantidad));
  }

  maxCandyVendido(): number {
    return Math.max(1, ...this.candyMasVendido().map(c => c.cantidad));
  }

  exportarPDF() {
    const doc = new jsPDF();
    const filas = this.facturacionPorDia();

    doc.setFontSize(16);
    doc.text('Roxis Movies - Reporte de facturación', 14, 15);

    doc.setFontSize(10);
    let y = 28;
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', 14, y);
    doc.text('Entradas vendidas', 80, y);
    doc.text('Facturación', 150, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
    doc.line(14, y, 196, y);
    y += 8;

    filas.forEach(fila => {
      doc.text(fila.dia, 14, y);
      doc.text(String(fila.cantidad), 80, y);
      doc.text(`$${fila.total}`, 150, y);
      y += 7;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    const totalGeneral = filas.reduce((acc, f) => acc + f.total, 0);
    const entradasGeneral = filas.reduce((acc, f) => acc + f.cantidad, 0);
    y += 3;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${entradasGeneral} entradas vendidas — $${totalGeneral}`, 14, y);

    doc.save('reporte-facturacion.pdf');
  }

  exportarExcel() {
    const filas = this.facturacionPorDia().map(f => ({
      Fecha: f.dia,
      'Entradas vendidas': f.cantidad,
      'Facturación ($)': f.total
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Facturación');
    XLSX.writeFile(libro, 'reporte-facturacion.xlsx');
  }

  // RECOMPENSAS (programa de puntos)

  async cargarRecompensas() {
    try {
      const data = await this.authService.obtenerRecompensas();
      this.recompensasList.set(data || []);
    } catch (error) {
      console.error('Error al cargar recompensas:', error);
    }
  }

  async guardarRecompensa() {
    if (this.recompensaForm.invalid) {
      this.mensajeError.set('⚠️ Completa nombre, puntos y valor de la recompensa.');
      return;
    }

    const formValues = this.recompensaForm.value;
    const datosRecompensa = {
      nombre: formValues.nombre,
      puntos_costo: Number(formValues.puntos_costo),
      valor_monetario: Number(formValues.valor_monetario)
    };

    try {
      const id = this.editandoRecompensaId();

      if (id) {
        const recompensaOriginal = this.recompensasList().find(r => r.id === id);
        await this.authService.actualizarRecompensa(id, { ...datosRecompensa, activo: recompensaOriginal?.activo ?? true });
        this.mensajeExito.set('🎁 ¡Recompensa actualizada!');
      } else {
        await this.authService.crearRecompensa(datosRecompensa);
        this.mensajeExito.set('🎁 ¡Recompensa creada!');
      }

      this.mensajeError.set(null);
      this.recompensaForm.reset({ puntos_costo: 500, valor_monetario: 0 });
      this.editandoRecompensaId.set(null);
      await this.cargarRecompensas();
    } catch (error: any) {
      this.mensajeError.set('❌ Error al guardar la recompensa.');
      this.mensajeExito.set(null);
    }
  }

  editarRecompensa(recompensa: any) {
    this.editandoRecompensaId.set(recompensa.id);
    this.recompensaForm.patchValue({
      nombre: recompensa.nombre,
      puntos_costo: recompensa.puntos_costo,
      valor_monetario: recompensa.valor_monetario
    });
  }

  cancelarEdicionRecompensa() {
    this.editandoRecompensaId.set(null);
    this.recompensaForm.reset({ puntos_costo: 500, valor_monetario: 0 });
  }

  // en vez de borrar directo, se puede desactivar: asi los canjes viejos de
  // esa recompensa mantienen su historial intacto
  async toggleActivoRecompensa(recompensa: any) {
    try {
      await this.authService.actualizarRecompensa(recompensa.id, {
        nombre: recompensa.nombre,
        puntos_costo: recompensa.puntos_costo,
        valor_monetario: recompensa.valor_monetario,
        activo: !recompensa.activo
      });
      await this.cargarRecompensas();
    } catch (error) {
      this.mensajeError.set('❌ No se pudo cambiar el estado de la recompensa.');
    }
  }

  pedirConfirmacionBorrarRecompensa(id: number) {
    this.confirmandoBorrarRecompensaId.set(id);
  }

  cancelarBorrarRecompensa() {
    this.confirmandoBorrarRecompensaId.set(null);
  }

  async borrarRecompensa(id: number) {
    try {
      await this.authService.eliminarRecompensa(id);
      this.confirmandoBorrarRecompensaId.set(null);
      this.mensajeExito.set('🗑️ Recompensa borrada.');
      this.mensajeError.set(null);
      await this.cargarRecompensas();
    } catch (error: any) {
      this.mensajeError.set('❌ No se pudo borrar: probablemente ya fue canjeada por algún usuario.');
      this.mensajeExito.set(null);
    }
  }
}
