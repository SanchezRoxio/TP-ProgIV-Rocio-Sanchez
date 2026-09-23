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

    async crearFunciones(listaFunciones: any[]) {
      const { data, error } = await this.supabase
        .from('funciones')
        .insert(listaFunciones);
      if (error) throw error;
      return data;
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
    .select('*')
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
      funciones ( dia, horario, peliculas ( titulo ), salas ( nombre ) ),
      entrada_butacas ( butacas ( fila, numero ) )
    `)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });

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

}
