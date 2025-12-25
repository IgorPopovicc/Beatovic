import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const adminOnlyGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasValidToken() && auth.hasRole('ADMIN')) return true;

  return router.createUrlTree(['/admin']);
};
