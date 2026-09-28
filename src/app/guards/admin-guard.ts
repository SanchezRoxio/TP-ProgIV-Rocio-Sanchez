import { inject } from '@angular/core';
import { Router, CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanMatchFn = async () => {
  // inject() tiene que llamarse aca xq
  // angular pierde el "contexto de inyección" apenas se cruza un await.
  const router = inject(Router);
  const authService = inject(AuthService);

  const rol = await authService.obtenerRolActual();
  // Uso esRolAdmin() del servicio en vez de comparar los strings acá mismo,
  // para que el guard y la directiva *appAdmin siempre estén de acuerdo en
  // qué roles cuentan como admin (antes tenía la lista repetida en los 2
  // lugares y se desincronizó).
  const esAdminOGerente = authService.esRolAdmin(rol);

  if (esAdminOGerente) {
    return true;
  }

  router.navigate(rol ? ['/inicio'] : ['/login']);
  return false;
};
