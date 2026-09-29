import { inject } from '@angular/core';
import { Router, CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const empleadoGuard: CanMatchFn = async () => {
  // inject() tiene que llamarse aca xq angular pierde el "contexto de
  // inyección" apenas se cruza un await, mismo tema que en admin-guard.ts
  const router = inject(Router);
  const authService = inject(AuthService);

  const rol = await authService.obtenerRolActual();
  const puedeValidar = authService.puedeValidarEntradas(rol);

  if (puedeValidar) {
    return true;
  }

  router.navigate(rol ? ['/inicio'] : ['/login']);
  return false;
};
