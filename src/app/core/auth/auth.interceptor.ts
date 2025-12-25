import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

function isTokenEndpoint(url: string): boolean {
  return url.includes('/protocol/openid-connect/token');
}

function isAdminApi(url: string): boolean {
  if (url.startsWith('/')) return url.startsWith('/api/admin');
  return url.startsWith(environment.apiBaseUrl + '/admin');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isTokenEndpoint(req.url)) return next(req);
  if (!isAdminApi(req.url)) return next(req);

  const token = inject(AuthService).accessToken();
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
