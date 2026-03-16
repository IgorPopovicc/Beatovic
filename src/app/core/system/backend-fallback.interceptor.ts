import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackendStatusService } from './backend-status.service';

const RETRYABLE_OUTAGE_STATUSES = new Set([0, 500, 502, 503, 504]);

function isMonitoredApiRequest(method: string, url: string): boolean {
  const isApiOrigin =
    url.startsWith(environment.apiBaseUrl) ||
    url.startsWith(environment.auth.host) ||
    url.startsWith('/api/');

  if (!isApiOrigin) return false;
  if (method === 'GET' || method === 'HEAD') return true;

  if (method === 'POST') {
    return (
      url.endsWith('/products/search') ||
      url.endsWith('/products/search-main') ||
      url.endsWith('/products/search-product')
    );
  }

  return false;
}

function shouldTriggerFallback(err: HttpErrorResponse): boolean {
  if (
    err.status === 400 ||
    err.status === 401 ||
    err.status === 403 ||
    err.status === 404 ||
    err.status === 422
  ) {
    return false;
  }

  return RETRYABLE_OUTAGE_STATUSES.has(err.status) || err.status >= 500;
}

function isHttpResponse(event: HttpEvent<unknown>): event is HttpResponse<unknown> {
  return event instanceof HttpResponse;
}

export const backendFallbackInterceptor: HttpInterceptorFn = (req, next) => {
  const backendStatus = inject(BackendStatusService);
  const monitored = isMonitoredApiRequest(req.method, req.url);

  return next(req).pipe(
    tap((event) => {
      if (!monitored || !isHttpResponse(event)) return;
      if (event.status >= 200 && event.status < 300) {
        backendStatus.markAvailable();
      }
    }),
    catchError((error: unknown) => {
      if (monitored && error instanceof HttpErrorResponse && shouldTriggerFallback(error)) {
        backendStatus.markUnavailable();
      }
      return throwError(() => error);
    }),
  );
};
