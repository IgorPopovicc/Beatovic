import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { isRuntimeApiUrl } from '../config/runtime-config.service';
import { TurnstileContext, TurnstileTokenService } from './turnstile-token.service';

const TURNSTILE_ERROR_MESSAGES = [
  'missing turnstile token.',
  'turnstile verification failed.',
  'unable to verify turnstile token.',
];

function isTrustedBackendUrl(url: string): boolean {
  return isRuntimeApiUrl(url);
}

function cleanPath(url: string): string {
  return url.split('?')[0].replace(/\/+$/, '').toLowerCase();
}

export function protectedTurnstileContext(
  method: string,
  url: string,
): TurnstileContext | null {
  if (method.toUpperCase() !== 'POST' || !isTrustedBackendUrl(url)) return null;

  const path = cleanPath(url);
  if (path.endsWith('/auth/admin-panel/login')) return 'admin-login';
  if (path.endsWith('/newsletter/subscribe')) return 'newsletter';
  if (path.endsWith('/contact/add')) return 'contact';
  if (path.endsWith('/orders/unregistered') || path.endsWith('/orders')) return 'checkout';
  return null;
}

function errorBodyText(error: HttpErrorResponse): string {
  if (typeof error.error === 'string') return error.error.trim().toLowerCase();
  if (!error.error || typeof error.error !== 'object') return '';

  const body = error.error as Record<string, unknown>;
  return [body['message'], body['error'], body['title']]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .trim()
    .toLowerCase();
}

export function isTurnstileVerificationError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return false;
  const body = errorBodyText(error);
  return TURNSTILE_ERROR_MESSAGES.some((message) => body.includes(message));
}

export const turnstileInterceptor: HttpInterceptorFn = (request, next) => {
  const context = protectedTurnstileContext(request.method, request.url);
  if (!context) return next(request);

  const tokens = inject(TurnstileTokenService);
  const token = tokens.token(context);
  const protectedRequest = token
    ? request.clone({ setHeaders: { 'X-Turnstile-Token': token } })
    : request;

  return next(protectedRequest).pipe(
    catchError((error: unknown) => {
      if (isTurnstileVerificationError(error)) {
        tokens.reset(context);
      }
      return throwError(() => error);
    }),
  );
};
