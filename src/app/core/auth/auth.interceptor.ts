import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { isRuntimeApiUrl } from '../config/runtime-config.service';
import { Router } from '@angular/router';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';

function isAuthEndpoint(url: string): boolean {
  const clean = url.split('?')[0].replace(/\/+$/, '');
  return clean.endsWith('/auth/admin-panel/login') || clean.endsWith('/auth/refresh-token');
}

function isPublicCatalogSearch(url: string): boolean {
  const clean = url.split('?')[0];
  return clean.endsWith('/products/search');
}

function isAdminApi(url: string): boolean {
  if (!isRuntimeApiUrl(url)) return false;
  const clean = url.split('?')[0];
  return /\/admin(?:\/|$)/.test(clean);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAuthEndpoint(req.url)) return next(req);

  // Public catalog search must stay anonymous; stale bearer token causes 401.
  if (isPublicCatalogSearch(req.url)) {
    if (!req.headers.has('Authorization')) return next(req);
    return next(req.clone({ headers: req.headers.delete('Authorization') }));
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const authenticatedRequest = isAdminApi(req.url) || req.headers.has('Authorization');
  if (!authenticatedRequest) return next(req);

  const token = auth.accessToken();
  const requestWithToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(requestWithToken).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.canRefresh()) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((accessToken) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })),
        ),
        catchError((refreshError: unknown) => {
          auth.logout();
          void router.navigateByUrl('/admin');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
