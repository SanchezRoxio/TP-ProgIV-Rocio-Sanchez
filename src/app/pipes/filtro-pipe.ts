import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filtroPelis',
  standalone: true
})
export class FiltroPelisPipe implements PipeTransform {
  transform(peliculas: any[], busqueda: string, generosSeleccionados: string[]): any[] {
    if (!peliculas) return [];

    return peliculas.filter(peli => {
      // Filtro por texto (busca en título y sinopsis)
      const textoBusqueda = busqueda.toLowerCase();
      const coincideTexto = !busqueda ||
      peli.titulo.toLowerCase().includes(textoBusqueda) ||
      (peli.sinopsis && peli.sinopsis.toLowerCase().includes(textoBusqueda));

      // si no hay ningún género tildado, pasan todas. Si hay alguno tildado,
      // alcanza con que la película tenga AL MENOS UNO de los géneros elegidos
      // (no le exijo que tenga TODOS los tildados, sería demasiado restrictivo)
      const coincideGenero = !generosSeleccionados || generosSeleccionados.length === 0 ||
        (peli.generos && generosSeleccionados.some(g => peli.generos.includes(g)));

      return coincideTexto && coincideGenero;
    });
  }
}