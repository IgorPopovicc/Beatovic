import {
  HttpErrorResponse,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  isTurnstileVerificationError,
  protectedTurnstileContext,
  turnstileInterceptor,
} from './turnstile.interceptor';
import { runtimeApiUrl } from '../config/runtime-config.service';
import { TurnstileTokenService } from './turnstile-token.service';

describe('Turnstile request matching', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('matches all protected POST routes, including order quote', () => {
    const base = runtimeApiUrl('');
    expect(protectedTurnstileContext('POST', `${base}/newsletter/subscribe`)).toBe('newsletter');
    expect(protectedTurnstileContext('POST', `${base}/contact/add`)).toBe('contact');
    expect(protectedTurnstileContext('POST', `${base}/orders`)).toBe('checkout');
    expect(protectedTurnstileContext('POST', `${base}/orders/quote`)).toBe('checkout');
    expect(protectedTurnstileContext('POST', `${base}/orders/unregistered`)).toBe('checkout');
    expect(
      protectedTurnstileContext(
        'POST',
        runtimeApiUrl('/auth/admin-panel/login'),
      ),
    ).toBe('admin-login');
  });

  it('does not match unrelated or external requests', () => {
    expect(protectedTurnstileContext('GET', runtimeApiUrl(`/orders`))).toBeNull();
    expect(protectedTurnstileContext('POST', runtimeApiUrl(`/products/search`))).toBeNull();
    expect(
      protectedTurnstileContext('POST', 'https://example.invalid/newsletter/subscribe'),
    ).toBeNull();
  });

  it('adds the token header only to a matched request and preserves existing headers', () => {
    const tokens = TestBed.inject(TurnstileTokenService);
    tokens.setToken('checkout', 'verified-token');
    const request = new HttpRequest('POST', runtimeApiUrl(`/orders/quote`), {}, {
      headers: new HttpHeaders({ 'X-Existing': 'kept' }),
    });
    let forwarded!: HttpRequest<unknown>;

    TestBed.runInInjectionContext(() =>
      turnstileInterceptor(request, (nextRequest) => {
        forwarded = nextRequest;
        return of(new HttpResponse({ status: 200 }));
      }).subscribe(),
    );

    expect(forwarded.headers.get('X-Turnstile-Token')).toBe('verified-token');
    expect(forwarded.headers.get('X-Existing')).toBe('kept');
  });

  it('recognizes only scoped backend Turnstile 403 messages', () => {
    expect(
      isTurnstileVerificationError(
        new HttpErrorResponse({ status: 403, error: 'Turnstile verification failed.' }),
      ),
    ).toBeTrue();
    expect(
      isTurnstileVerificationError(new HttpErrorResponse({ status: 403, error: 'Forbidden' })),
    ).toBeFalse();
  });

  it('invalidates the scoped token after a Turnstile verification failure', () => {
    const tokens = TestBed.inject(TurnstileTokenService);
    tokens.setToken('checkout', 'single-use-token');
    const request = new HttpRequest('POST', runtimeApiUrl(`/orders`), {});

    TestBed.runInInjectionContext(() =>
      turnstileInterceptor(request, () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: 'Unable to verify Turnstile token.',
            }),
        ),
      ).subscribe({ error: () => undefined }),
    );

    expect(tokens.token('checkout')).toBeNull();
  });
});
