import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const adminLoginRedirectGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const hasValidToken = auth.hasValidToken();
  const hasAdminRole = auth.hasRole('ADMIN');

  if (!hasValidToken) return true;
  if (!hasAdminRole) return true;

  return router.createUrlTree(['/admin/panel']);
};
