import { CanMatchFn, Router, UrlSegment } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { map } from 'rxjs/operators';

export const adminOnlyGuard: CanMatchFn = (_route, segments: UrlSegment[]) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Let the dedicated `/admin` login route handle exact `/admin`.
  const isExactAdminRoot = segments.length === 1 && segments[0]?.path === 'admin';
  if (isExactAdminRoot) return false;
  return auth
    .ensureValidAdminSession()
    .pipe(map((valid) => (valid ? true : router.createUrlTree(['/admin']))));
};
