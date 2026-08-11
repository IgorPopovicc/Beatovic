import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { map } from 'rxjs/operators';

export const adminLoginRedirectGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .ensureValidAdminSession()
    .pipe(map((valid) => (valid ? router.createUrlTree(['/admin/panel']) : true)));
};
