// estas 3 funciones arman una "clave" de texto para agrupar fechas: dos
// fechas que caen el mismo día/semana/mes van a dar exactamente la misma
// clave, así se pueden agrupar con un Map en vez de tener que consultarle
// a postgres un group by (para el volumen de datos de este TP alcanza y sobra)

export function claveDia(fecha: Date): string {
  return fecha.toISOString().split('T')[0]; // "2026-09-29"
}

export function claveMes(fecha: Date): string {
  return fecha.toISOString().slice(0, 7); // "2026-09"
}

// numero de semana ISO 8601: la semana 1 es la que contiene el primer jueves
// del año. Es el mismo criterio que usa, por ejemplo, Excel
export function claveSemana(fecha: Date): string {
  const copia = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemanaIso = copia.getUTCDay() || 7; // domingo (0) pasa a ser 7
  copia.setUTCDate(copia.getUTCDate() + 4 - diaSemanaIso);

  const inicioDeAño = new Date(Date.UTC(copia.getUTCFullYear(), 0, 1));
  const numeroSemana = Math.ceil((((copia.getTime() - inicioDeAño.getTime()) / 86400000) + 1) / 7);

  return `${copia.getUTCFullYear()}-S${String(numeroSemana).padStart(2, '0')}`;
}
