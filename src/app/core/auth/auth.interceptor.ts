import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

function isTokenEndpoint(url: string): boolean {
  return url.includes('/protocol/openid-connect/token');
}

function isPublicCatalogSearch(url: string): boolean {
  const clean = url.split('?')[0];
  return clean.endsWith('/products/search');
}

function isAdminApi(url: string): boolean {
  if (url.startsWith('/')) return url.startsWith('/api/admin');
  return url.startsWith(environment.apiBaseUrl + '/admin');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isTokenEndpoint(req.url)) return next(req);

  // Public catalog search must stay anonymous; stale bearer token causes 401.
  if (isPublicCatalogSearch(req.url)) {
    if (!req.headers.has('Authorization')) return next(req);
    return next(req.clone({ headers: req.headers.delete('Authorization') }));
  }

  if (!isAdminApi(req.url)) return next(req);

  const auth = inject(AuthService);
  const token = auth.accessToken();
  if (!auth.hasValidToken()) return next(req);
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
