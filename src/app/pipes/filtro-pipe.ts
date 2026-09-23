import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filtroPelis',
  standalone: true
})
export class FiltroPelisPipe implements PipeTransform {
  transform(peliculas: any[], busqueda: string, generoSeleccionado: string): any[] {
    if (!peliculas) return [];

    return peliculas.filter(peli => {
      // Filtro por texto (busca en título y sinopsis)
      const textoBusqueda = busqueda.toLowerCase();
      const coincideTexto = !busqueda ||
      peli.titulo.toLowerCase().includes(textoBusqueda) ||
      (peli.sinopsis && peli.sinopsis.toLowerCase().includes(textoBusqueda));
      
      // Filtro por genero (si es 'TODOS' o esta vacio, pasa; sino busca si incluye el genero)
      const coincideGenero = !generoSeleccionado || generoSeleccionado === 'TODOS' || (peli.generos && peli.generos.includes(generoSeleccionado));

      return coincideTexto && coincideGenero;
    });
  }
}