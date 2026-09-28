import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;

usuarioActual = signal<any>(null);

constructor() {
  this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  this.cargarSesionActual();

  // Si Supabase detecta login/logout (por ejemplo al refrescar la página), nos enteramos acá
  this.supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      this.cargarPerfil(session.user.id);
    } else {
      this.usuarioActual.set(null);
    }
  });
}

private async cargarSesionActual() {
  const { data } = await this.supabase.auth.getSession();
  if (data.session?.user) {
    await this.cargarPerfil(data.session.user.id);
  }
}

private async cargarPerfil(userId: string) {
  const { data, error } = await this.supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single();

  if (!error) this.usuarioActual.set(data);
}

async login(email: string, password: string) {
  const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Credenciales inválidas');

  await this.cargarPerfil(data.user.id);
  return this.usuarioActual();
}

async haySesionActiva(): Promise<boolean> {
  const { data } = await this.supabase.auth.getSession();
  return !!data.session;
}

// centralizo aca qué roles cuentan como "admin", para no repetir esta
// lista en el guard y en la directiva por separado (si la repito en los 2 lugares, en algún momento me voy a olvidar de actualizar uno de los 2, como ya me pasó con 'administrador' jajaj).
esRolAdmin(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'gerente' || rol === 'administrador';
}

async obtenerRolActual(): Promise<string | null> {
  const { data } = await this.supabase.auth.getSession();
  if (!data.session?.user) return null;

  const { data: perfil } = await this.supabase
    .from('usuarios')
    .select('rol')
    .eq('id', data.session.user.id)
    .single();

  return perfil?.rol ?? null;
}

async cerrarSesion() {
  await this.supabase.auth.signOut();
  this.usuarioActual.set(null);
}

async registrarUsuario(userData: any) {
  const { email, password, ...perfil } = userData;

  const { data, error } = await this.supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('No se pudo crear la cuenta');

  const { error: errorPerfil } = await this.supabase
    .from('usuarios')
    .insert([{ id: data.user.id, email, ...perfil }]);

  if (errorPerfil) throw new Error(errorPerfil.message);
  return data.user;
}

  async obtenerPeliculas() {
    const { data, error } = await this.supabase
      .from('peliculas')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async obtenerCandy() {
    const { data, error } = await this.supabase
      .from('candy')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  async crearPelicula(datosPeli: any) {
      const { data, error } = await this.supabase
        .from('peliculas')
        .insert([datosPeli])
        .select();
      if (error) throw error;
      return data;
    }

  // uso esto para editar una pelicula ya cargada, le mando el id y los datos nuevos
  async actualizarPelicula(id: number, datosPeli: any) {
    const { data, error } = await this.supabase.from('peliculas').update(datosPeli).eq('id', id);
    if (error) throw error;
    return data;
  }

  // ojo con esto: si la pelicula tiene funciones con entradas vendidas, postgres
  // va a rechazar el borrado por la relacion de FK, asi que hay
  // que atajar el error en el componente y mostrar un mensaje entendible
  async eliminarPelicula(id: number) {
    const { error } = await this.supabase.from('peliculas').delete().eq('id', id);
    if (error) throw error;
  }

    async crearFunciones(listaFunciones: any[]) {
      const { data, error } = await this.supabase
        .from('funciones')
        .insert(listaFunciones);
      if (error) throw error;
      return data;
    }

  async actualizarSala(id: number, nombre: string) {
    const { data, error } = await this.supabase.from('salas').update({ nombre }).eq('id', id);
    if (error) throw error;
    return data;
  }

  async eliminarSala(id: number) {
    const { error } = await this.supabase.from('salas').delete().eq('id', id);
    if (error) throw error;
  }

  async crearCandy(datosCandy: any) {
    const { data, error } = await this.supabase
      .from('candy')
      .insert([datosCandy]);
    if (error) throw error;
    return data;
  }

  async obtenerFuncionesPorPelicula(peliculaId: number) {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*')
      .eq('pelicula_id', peliculaId);

    if (error) throw error;
    return data || [];
  }

  // uso esto para editar una funcion ya creada. Mantengo la sala que ya tenia
  // asignada (no la reasigno), pero igual valido el margen de 30 min contra
  // las demas funciones de ESA MISMA sala y dia, para no romper la regla de
  // "nunca dos funciones a la vez en la misma sala" si cambiás el horario
  async actualizarFuncion(id: number, datos: { dia: string; horario: string; formato: string; idioma: string; duracion: number }) {
    const { data: funcionActual, error: errorActual } = await this.supabase
      .from('funciones')
      .select('sala_id')
      .eq('id', id)
      .single();
    if (errorActual) throw errorActual;

    const todasLasFunciones = await this.obtenerTodasLasFunciones();
    const [hNuevo, mNuevo] = datos.horario.split(':').map(Number);
    const inicioNuevoMinutos = hNuevo * 60 + mNuevo;
    const finNuevoMinutos = inicioNuevoMinutos + datos.duracion + 30;

    const funcionesDeSala = todasLasFunciones.filter(
      f => f.sala_id === funcionActual.sala_id && f.dia === datos.dia && f.id !== id
    );

    for (const func of funcionesDeSala) {
      const [hExistente, mExistente] = func.horario.split(':').map(Number);
      const inicioExistenteMinutos = hExistente * 60 + mExistente;
      const finExistenteMinutos = inicioExistenteMinutos + (func.duracion || 120) + 30;

      if (inicioNuevoMinutos < finExistenteMinutos && finNuevoMinutos > inicioExistenteMinutos) {
        throw new Error(`Ese horario choca con otra función en la misma sala el ${datos.dia}. Recordá dejar 30 minutos entre funciones.`);
      }
    }

    const { error } = await this.supabase.from('funciones').update(datos).eq('id', id);
    if (error) throw error;
  }

  // si la funcion ya tiene entradas vendidas, postgres rechaza el borrado por
  // la FK, asi que hay que atajar el error en el componente
  async eliminarFuncion(id: number) {
    const { error } = await this.supabase.from('funciones').delete().eq('id', id);
    if (error) throw error;
  }

  async obtenerResenasPorPelicula(peliculaId: number) {
    const { data, error } = await this.supabase
      .from('resenas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async crearResena(nuevaResena: any) {
    const { data, error } = await this.supabase
      .from('resenas')
      .insert([nuevaResena]);

    if (error) throw error;
    return data;
  }

    async crearSala(nombre: string) {
    const { data, error } = await this.supabase
      .from('salas')
      .insert([{ nombre }])
      .select();
    if (error) throw error;
    return data;
  }


  // 1. Obtener todas las salas de la base de datos
  async obtenerSalas() {
    const { data, error } = await this.supabase
      .from('salas')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  // 2. Obtener todas las funciones programadas en general
  async obtenerTodasLasFunciones() {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*');
    if (error) throw error;
    return data || [];
  }

// Logica de asignación automática con 30 minutos de margen
  async programarFuncionConMargen(peliculaId: number, dia: string, horaInicio: string, duracionMinutos: number, formato: string, idioma: string) {
  const salas = await this.obtenerSalas();
  const todasLasFunciones = await this.obtenerTodasLasFunciones();

  const [hNuevo, mNuevo] = horaInicio.split(':').map(Number);
  const inicioNuevoMinutos = hNuevo * 60 + mNuevo;
  const finNuevoMinutos = inicioNuevoMinutos + duracionMinutos + 30;
  let salaAsignadaId = null;

  for (const sala of salas) {
    // Solo comparamos contra funciones de esta sala EN EL MISMO DÍA
    const funcionesDeSala = todasLasFunciones.filter(f => f.sala_id === sala.id && f.dia === dia);
    let salaOcupada = false;

    for (const func of funcionesDeSala) {
      const [hExistente, mExistente] = func.horario.split(':').map(Number);
      const inicioExistenteMinutos = hExistente * 60 + mExistente;
      const finExistenteMinutos = inicioExistenteMinutos + (func.duracion || 120) + 30;

      if (inicioNuevoMinutos < finExistenteMinutos && finNuevoMinutos > inicioExistenteMinutos) {
        salaOcupada = true;
        break;
      }
    }

    if (!salaOcupada) {
      salaAsignadaId = sala.id;
      break;
    }
  }

  if (!salaAsignadaId) {
    throw new Error(`No hay salas libres el ${dia} a las ${horaInicio}. Recuerda dejar 30 minutos entre funciones.`);
  }

  const { data, error } = await this.supabase
    .from('funciones')
    .insert([{
      pelicula_id: peliculaId,
      sala_id: salaAsignadaId,
      dia: dia,
      horario: horaInicio,
      duracion: duracionMinutos,
      formato: formato,
      idioma: idioma
    }]);

  if (error) throw error;
  return data;
    }

  async obtenerFuncionPorId(funcionId: number) {
  const { data, error } = await this.supabase
    .from('funciones')
    .select('*, peliculas(precio_preventa, fecha_estreno)')
    .eq('id', funcionId)
    .single();
  if (error) throw error;
  return data;
}

async obtenerButacasDeSala(salaId: number) {
  const { data, error } = await this.supabase
    .from('butacas')
    .select('*')
    .eq('sala_id', salaId);
  if (error) throw error;
  return data || [];
}

async obtenerButacasOcupadas(funcionId: number) {
  const { data, error } = await this.supabase
    .from('entrada_butacas')
    .select('butaca_id')
    .eq('funcion_id', funcionId);
  if (error) throw error;
  return (data || []).map((d: any) => d.butaca_id);
}

async finalizarCompra(datos: {
  usuarioId: string | null;
  funcionId: number;
  total: number;
  butacas: { butacaId: number; precio: number }[];
  candy: { candyId: number; cantidad: number; precioUnitario: number }[];
  combos: { comboId: number; cantidad: number; precioUnitario: number }[];
}) {
  const { data: entradaData, error: errorEntrada } = await this.supabase
    .from('entradas')
    .insert([{ usuario_id: datos.usuarioId, funcion_id: datos.funcionId, total: datos.total }])
    .select();
  if (errorEntrada) throw errorEntrada;

  const entrada = entradaData[0];

  const filasButacas = datos.butacas.map(b => ({
    entrada_id: entrada.id,
    funcion_id: datos.funcionId,
    butaca_id: b.butacaId,
    precio: b.precio
  }));
  const { error: errorButacas } = await this.supabase.from('entrada_butacas').insert(filasButacas);
  if (errorButacas) throw errorButacas;

  if (datos.candy.length > 0) {
    const filasCandy = datos.candy.map(c => ({
      entrada_id: entrada.id,
      candy_id: c.candyId,
      cantidad: c.cantidad,
      precio_unitario: c.precioUnitario
    }));
    const { error: errorCandy } = await this.supabase.from('entrada_candy').insert(filasCandy);
    if (errorCandy) throw errorCandy;
  }

  if (datos.combos.length > 0) {
    const filasCombos = datos.combos.map(c => ({
      entrada_id: entrada.id,
      combo_id: c.comboId,
      cantidad: c.cantidad,
      precio_unitario: c.precioUnitario
    }));
    const { error: errorCombos } = await this.supabase.from('entrada_combos').insert(filasCombos);
    if (errorCombos) throw errorCombos;
  }

  return entrada;
}

suscribirseAButacas(funcionId: number, onCambio: (butacaId: number) => void) {
  const canal = this.supabase
    .channel(`butacas-funcion-${funcionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'entrada_butacas', filter: `funcion_id=eq.${funcionId}` },
      (payload: any) => onCambio(payload.new['butaca_id'])
    )
    .subscribe();

  return () => {
    this.supabase.removeChannel(canal);
  };
}

async obtenerMisEntradas(usuarioId: string) {
  const { data, error } = await this.supabase
    .from('entradas')
    .select(`
      id, total, estado, created_at,
      funciones ( dia, horario, peliculas ( id, titulo, imagen ), salas ( nombre ) ),
      entrada_butacas ( butacas ( fila, numero ) )
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async obtenerMisCalificaciones(usuarioId: string) {
  const { data, error } = await this.supabase
    .from('resenas')
    .select('pelicula_id, estrellas')
    .eq('usuario_id', usuarioId);

  if (error) throw error;
  return data || [];
}

//EDITAR EL CANDY

async actualizarCandy(id: number, datosCandy: any) {
  const { data, error } = await this.supabase
    .from('candy')
    .update(datosCandy)
    .eq('id', id);
  if (error) throw error;
  return data;
}

async eliminarCandy(id: number) {
  const { error } = await this.supabase.from('candy').delete().eq('id', id);
  if (error) throw error;
}

async crearCombo(nombre: string, precio: number, items: { candyId: number; cantidad: number }[]) {
  const { data: comboData, error: errorCombo } = await this.supabase
    .from('combos')
    .insert([{ nombre, precio }])
    .select();
  if (errorCombo) throw errorCombo;

  const combo = comboData[0];

  const filasItems = items.map(item => ({
    combo_id: combo.id,
    candy_id: item.candyId,
    cantidad: item.cantidad
  }));

  const { error: errorItems } = await this.supabase.from('combo_items').insert(filasItems);
  if (errorItems) throw errorItems;

  return combo;
}

// para editar un combo, en vez de tratar de "actualizar" cada item uno por uno,
// borro todos los combo_items viejos y cargo los nuevos de cero. Es mas simple
// y el resultado es el mismo (la cantidad de items por combo es chica)
async actualizarCombo(id: number, nombre: string, precio: number, items: { candyId: number; cantidad: number }[]) {
  const { error: errorCombo } = await this.supabase.from('combos').update({ nombre, precio }).eq('id', id);
  if (errorCombo) throw errorCombo;

  const { error: errorBorrar } = await this.supabase.from('combo_items').delete().eq('combo_id', id);
  if (errorBorrar) throw errorBorrar;

  const filasItems = items.map(item => ({ combo_id: id, candy_id: item.candyId, cantidad: item.cantidad }));
  const { error: errorItems } = await this.supabase.from('combo_items').insert(filasItems);
  if (errorItems) throw errorItems;
}

// si el combo ya fue comprado en alguna entrada, postgres rechaza el borrado por la FK
async eliminarCombo(id: number) {
  const { error: errorItems } = await this.supabase.from('combo_items').delete().eq('combo_id', id);
  if (errorItems) throw errorItems;

  const { error } = await this.supabase.from('combos').delete().eq('id', id);
  if (error) throw error;
}

// log de auditoria: guarda quien hizo que accion, con fecha y hora (created_at por default)
async registrarLog(usuarioId: string | null, accion: string, detalle: string) {
  const { error } = await this.supabase.from('logs_auditoria').insert([{ usuario_id: usuarioId, accion, detalle }]);
  // si falla el insert del log, solo lo aviso por consola, no lo tiro como error real.
  // la idea es que un problema guardando el log nunca rompa la accion que si funciono bien
  // (por ejemplo, crear la funcion ya se hizo antes de llamar a este metodo)
  if (error) console.error('No se pudo registrar el log:', error);
}

// trae los ultimos 100 logs, del mas nuevo al mas viejo, con el nombre/email
// de quien hizo cada accion (join contra usuarios)
async obtenerLogs() {
  const { data, error } = await this.supabase
    .from('logs_auditoria')
    .select('*, usuarios(nombre, apellido, email)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

async obtenerCombos() {
  const { data, error } = await this.supabase
    .from('combos')
    .select('*, combo_items(cantidad, candy(id, nombre, precio, imagen))');
  if (error) throw error;
  return data || [];
}

// estrenos 
async activarAlertaEstreno(usuarioId: string, peliculaId: number) {
  const { error } = await this.supabase
    .from('alertas_estreno')
    .insert([{ usuario_id: usuarioId, pelicula_id: peliculaId }]);
  if (error && error.code !== '23505') throw error; //codigo que usa Postgres para "violacion de restriccion unica"
}

async obtenerMisAlertas(usuarioId: string) {
  const { data, error } = await this.supabase
    .from('alertas_estreno')
    .select('pelicula_id')
    .eq('usuario_id', usuarioId);
  if (error) throw error;
  return (data || []).map((d: any) => d.pelicula_id);
}

// CUPONES

// el codigo siempre se guarda en mayusculas, asi despues no importa como
// lo tipee el usuario en /pago (BIENVENIDA20 == bienvenida20 == Bienvenida20)
async crearCupon(datos: { codigo: string; descuento_porcentaje: number; fecha_vencimiento: string | null; solo_mayores_50: boolean; solo_primera_compra: boolean }) {
  const { data, error } = await this.supabase
    .from('cupones')
    .insert([{ ...datos, codigo: datos.codigo.toUpperCase() }])
    .select();
  if (error) throw error;
  return data;
}

async obtenerCupones() {
  const { data, error } = await this.supabase
    .from('cupones')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async actualizarCupon(id: number, datos: { codigo: string; descuento_porcentaje: number; fecha_vencimiento: string | null; activo: boolean; solo_mayores_50: boolean; solo_primera_compra: boolean }) {
  const { error } = await this.supabase
    .from('cupones')
    .update({ ...datos, codigo: datos.codigo.toUpperCase() })
    .eq('id', id);
  if (error) throw error;
}

async eliminarCupon(id: number) {
  const { error } = await this.supabase.from('cupones').delete().eq('id', id);
  if (error) throw error;
}

// esto lo usa /pago para validar el codigo que tipea el usuario. Devuelve
// el cupon solo si existe, esta activo, y no vencio. Si no cumple algo de
// eso, devuelve null y pago.ts muestra "cupon invalido".
// usuarioId y fechaNacimientoUsuario se mandan solo si hay un usuario logueado,
// para poder chequear los cupones restringidos a mayores de 50 o a primera
// compra (un invitado sin cuenta nunca puede usar esos dos tipos de cupon)
async validarCupon(codigo: string, usuarioId: string | null, fechaNacimientoUsuario: string | null) {
  const { data, error } = await this.supabase
    .from('cupones')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const hoy = new Date().toISOString().split('T')[0];
  if (data.fecha_vencimiento && data.fecha_vencimiento < hoy) return null;

  if (data.solo_mayores_50) {
    if (!fechaNacimientoUsuario) return null;

    const nacimiento = new Date(fechaNacimientoUsuario);
    const hoyDate = new Date();
    let edad = hoyDate.getFullYear() - nacimiento.getFullYear();
    const yaCumplioEsteAño = hoyDate.getMonth() > nacimiento.getMonth() ||
      (hoyDate.getMonth() === nacimiento.getMonth() && hoyDate.getDate() >= nacimiento.getDate());
    if (!yaCumplioEsteAño) edad--;

    if (edad < 50) return null;
  }

  if (data.solo_primera_compra) {
    if (!usuarioId) return null; // un invitado no tiene forma de probar que es su primera compra

    const { count, error: errorConteo } = await this.supabase
      .from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId);
    if (errorConteo) throw errorConteo;

    if ((count ?? 0) > 0) return null; // ya compró antes, no es su primera compra
  }

  return data;
}

}