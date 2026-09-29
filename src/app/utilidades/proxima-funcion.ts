const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * proximaOcurrencia - Las funciones son recurrentes (se repiten cada semana
 * el mismo día y horario, no tienen guardada una fecha puntual en la base),
 * así que para saber "cuánto falta para la función" hay que calcular cuándo
 * cae la próxima vez ese día+horario a partir de ahora.
 */
export function proximaOcurrencia(dia: string, horario: string): Date {
  const [horas, minutos] = horario.split(':').map(Number);
  const diaObjetivo = DIAS.indexOf(dia);

  const ahora = new Date();
  const resultado = new Date(ahora);
  resultado.setHours(horas, minutos, 0, 0);

  // cuantos dias hay que sumar desde hoy para llegar al dia de la funcion
  let diasHastaObjetivo = (diaObjetivo - ahora.getDay() + 7) % 7;
  resultado.setDate(ahora.getDate() + diasHastaObjetivo);

  // si el dia calculado termina siendo hoy pero el horario ya pasó,
  // en realidad es la funcion de la semana que viene
  if (resultado.getTime() < ahora.getTime()) {
    resultado.setDate(resultado.getDate() + 7);
  }

  return resultado;
}

// true si a esta funcion todavia le faltan al menos 2 horas para empezar
export function faltanMasDe2Horas(dia: string, horario: string): boolean {
  const dosHorasEnMs = 2 * 60 * 60 * 1000;
  return proximaOcurrencia(dia, horario).getTime() - Date.now() >= dosHorasEnMs;
}
