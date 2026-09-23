import { inject } from '@angular/core';
import { Router, CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanMatchFn = async () => {
  // inject() tiene que llamarse aca xq
  // Angular pierde el "contexto de inyección" apenas se cruza un await.
  const router = inject(Router);
  const authService = inject(AuthService);

  const rol = await authService.obtenerRolActual();
  const esAdminOGerente = rol === 'admin' || rol === 'gerente' || rol === 'administrador';

  if (esAdminOGerente) {
    return true;
  }

  router.navigate(rol ? ['/inicio'] : ['/login']);
  return false;
};
