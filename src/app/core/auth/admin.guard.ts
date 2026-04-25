import { CanMatchFn, Router, UrlSegment } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const adminOnlyGuard: CanMatchFn = (_route, segments: UrlSegment[]) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Let the dedicated `/admin` login route handle exact `/admin`.
  const isExactAdminRoot = segments.length === 1 && segments[0]?.path === 'admin';
  const hasValidToken = auth.hasValidToken();
  const hasAdminRole = auth.hasRole('ADMIN');

  if (isExactAdminRoot) return false;

  if (hasValidToken && hasAdminRole) return true;

  return router.createUrlTree(['/admin']);
};
