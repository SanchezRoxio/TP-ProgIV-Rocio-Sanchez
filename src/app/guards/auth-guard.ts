import { inject } from '@angular/core';
import { Router, CanMatchFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanMatchFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const activa = await authService.haySesionActiva();
  if (activa) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
