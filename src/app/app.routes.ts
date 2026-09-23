import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./componentes/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'inicio',
    loadComponent: () => import('./componentes/inicio/inicio').then(m => m.InicioComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./componentes/registro/registro').then(m => m.RegistroComponent)
  },
  {
    path: 'detalle/:id',
    loadComponent: () => import('./componentes/detalle/detalle').then(m => m.DetalleComponent)
  },
  {
    path: 'butacas/:funcionId',
    loadComponent: () => import('./componentes/butacas/butacas').then(m => m.ButacasComponent),
    //canMatch: [authGuard] 
  },
  {
    path: 'candy',
    loadComponent: () => import('./componentes/candy/candy').then(m => m.CandyComponent)
  },
  {
    path: 'pago',
    loadComponent: () => import('./componentes/pago/pago').then(m => m.PagoComponent),
    //canMatch: [authGuard] 
  },
  {
    path: 'perfil',
    loadComponent: () => import('./componentes/perfil/perfil').then(m => m.PerfilComponent),
    canMatch: [authGuard] 
  },
  {
    path: 'admin',
    loadComponent: () => import('./componentes/admin/admin').then(m => m.AdminComponent),
    canMatch: [adminGuard] // <--- (¡ADMIN!)
  },
  {
    path: '**',
    redirectTo: 'inicio'
  }
];