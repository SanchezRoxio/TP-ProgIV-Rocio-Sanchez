import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface Butaca {
  id: string;              // 'fila-numero'
  butacaId: number | null; // id real en db (null si es pasillo)
  fila: string;
  numero: number;
  estado: 'disponible' | 'seleccionada' | 'ocupada';
  tipo: 'general' | 'discapacidad' | 'vip';
  esPasillo: boolean;
}

@Component({
  selector: 'app-butacas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './butacas.html',
  styleUrl: './butacas.css'
})
export class ButacasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

  funcionId = 0;
  cargando = signal<boolean>(true);
  error = signal<string>('');

  butacas = signal<Butaca[]>([]);
  seleccionadas = signal<string[]>([]);
  private detenerSuscripcion: (() => void) | null = null;

  async ngOnInit() {
    this.funcionId = Number(this.route.snapshot.paramMap.get('funcionId'));
    this.detenerSuscripcion = this.authService.suscribirseAButacas(this.funcionId, (butacaId) => {
      this.marcarOcupada(butacaId);
      });


    try {
      const funcion = await this.authService.obtenerFuncionPorId(this.funcionId);

      const [butacasReales, ocupadas] = await Promise.all([
        this.authService.obtenerButacasDeSala(funcion.sala_id),
        this.authService.obtenerButacasOcupadas(this.funcionId)
      ]);

      this.butacas.set(this.armarGrilla(butacasReales, ocupadas));
    } catch (err) {
      console.error('Error al cargar butacas:', err);
      this.error.set('No se pudo cargar la sala. Volvé a intentar.');
    } finally {
      this.cargando.set(false);
    }
  }

  private armarGrilla(butacasReales: any[], ocupadas: number[]): Butaca[] {
    const mapa = new Map<string, any>();
    butacasReales.forEach(b => mapa.set(`${b.fila}-${b.numero}`, b));

    const lista: Butaca[] = [];
    this.filas.forEach(fila => {
      for (let i = 1; i <= 30; i++) {
        const real = mapa.get(`${fila}-${i}`);

        if (!real) {
          lista.push({
            id: `${fila}-${i}`, butacaId: null, fila, numero: i,
            estado: 'disponible', tipo: 'general', esPasillo: true
          });
        } else {
          lista.push({
            id: `${fila}-${i}`, butacaId: real.id, fila, numero: i,
            estado: ocupadas.includes(real.id) ? 'ocupada' : 'disponible',
            tipo: real.tipo, esPasillo: false
          });
        }
      }
    });
    return lista;
  }

  private marcarOcupada(butacaId: number) {
  this.butacas.update(asientos =>
    asientos.map(a => a.butacaId === butacaId ? { ...a, estado: 'ocupada' } : a)
    );
  }

  ngOnDestroy() {
    if (this.detenerSuscripcion) {
      this.detenerSuscripcion();
    }
  }

  obtenerButacasFila(fila: string) {
    return this.butacas().filter(b => b.fila === fila);
  }

  seleccionarButaca(butaca: Butaca) {
    if (butaca.esPasillo || butaca.estado === 'ocupada') return;

    this.butacas.update(asientos =>
      asientos.map(a => {
        if (a.id === butaca.id) {
          const nuevoEstado = a.estado === 'seleccionada' ? 'disponible' : 'seleccionada';
          return { ...a, estado: nuevoEstado };
        }
        return a;
      })
    );

    const actual = this.seleccionadas();
    if (actual.includes(butaca.id)) {
      this.seleccionadas.set(actual.filter(id => id !== butaca.id));
    } else {
      this.seleccionadas.update(ids => [...ids, butaca.id]);
    }
  }

  confirmarCompra() {
    const idsSeleccionados = this.seleccionadas();
    const butacasSeleccionadas = this.butacas().filter(b => idsSeleccionados.includes(b.id));
    const seleccion = {
      funcionId: this.funcionId,
      butacas: butacasSeleccionadas.map(b => ({ butacaId: b.butacaId, fila: b.fila, numero: b.numero, tipo: b.tipo }))
    };

    this.router.navigate(['/candy'], { state: { seleccion } });
  }

  volver() {
    this.router.navigate(['/inicio']);
  }
}