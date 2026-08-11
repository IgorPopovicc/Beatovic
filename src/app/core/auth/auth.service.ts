import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { runtimeApiUrl } from '../config/runtime-config.service';
import { AdminLoginResponse } from './auth.models';
import { decodeJwtPayload } from './jwt';
import { finalize, map, shareReplay, tap, timeout } from 'rxjs/operators';
import { catchError, Observable, of, throwError } from 'rxjs';
import { BrowserStorageService } from './browser-storage.service';

const ACCESS_TOKEN_KEY = 'ps_access_token';
const REFRESH_TOKEN_KEY = 'ps_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(BrowserStorageService);

  private readonly accessTokenSig = signal<string | null>(this.storage.get(ACCESS_TOKEN_KEY));
  private readonly refreshTokenSig = signal<string | null>(this.storage.get(REFRESH_TOKEN_KEY));
  private refreshRequest$: Observable<string> | null = null;
  readonly accessToken = this.accessTokenSig.asReadonly();

  constructor() {
    // Malformed tokens cannot be refreshed safely. Expired well-formed tokens remain until the
    // single-flight refresh path replaces them.
    if (this.accessTokenSig() && !decodeJwtPayload(this.accessTokenSig()!)) {
      this.logout();
    }
  }

  readonly isAuthenticated = computed(() => {
    const token = this.accessTokenSig();
    if (!token) return false;

    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    if (!payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  });

  readonly roles = computed(() => {
    const token = this.accessTokenSig();
    if (!token) return [] as string[];
    const payload = decodeJwtPayload(token);
    const realmRoles: string[] = payload?.realm_access?.roles ?? [];
    return realmRoles;
  });

  readonly isAdmin = computed(() => this.roles().includes('ADMIN'));
  readonly username = computed(() => {
    const token = this.accessTokenSig();
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    return payload?.preferred_username ?? payload?.email ?? payload?.name ?? payload?.sub ?? null;
  });

  login(username: string, password: string): Observable<void> {
    const url = runtimeApiUrl('/auth/admin-panel/login');
    const body = { username, password };

    return this.http
      .post<AdminLoginResponse>(url, body, {
        headers: { 'Content-Type': 'application/json' },
      })
      .pipe(
        timeout(15000),
        tap((res) => {
          const token = res?.accessToken ?? '';
          if (!token) {
            throw new Error('Login response ne sadrži accessToken.');
          }
          this.storage.set(ACCESS_TOKEN_KEY, token);
          this.accessTokenSig.set(token);
          const refreshToken = String(res?.refreshToken ?? '').trim();
          if (refreshToken) {
            this.storage.set(REFRESH_TOKEN_KEY, refreshToken);
            this.refreshTokenSig.set(refreshToken);
          } else {
            this.storage.remove(REFRESH_TOKEN_KEY);
            this.refreshTokenSig.set(null);
          }
        }),
        map(() => void 0),
        catchError((err) => {
          console.error('TOKEN REQUEST FAILED:', err);
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    this.storage.remove(ACCESS_TOKEN_KEY);
    this.storage.remove(REFRESH_TOKEN_KEY);
    this.accessTokenSig.set(null);
    this.refreshTokenSig.set(null);
  }

  canRefresh(): boolean {
    return !!this.refreshTokenSig();
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest$) return this.refreshRequest$;

    const refreshToken = this.refreshTokenSig();
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token nije dostupan.'));
    }

    const request$ = this.http
      .post<AdminLoginResponse>(runtimeApiUrl(`/auth/refresh-token`), { refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
      })
      .pipe(
        timeout(15000),
        map((response) => {
          const accessToken = String(response?.accessToken ?? '').trim();
          if (!accessToken) throw new Error('Refresh response ne sadrži accessToken.');
          return { accessToken, refreshToken: String(response?.refreshToken ?? '').trim() };
        }),
        tap(({ accessToken, refreshToken: replacementRefreshToken }) => {
          this.storage.set(ACCESS_TOKEN_KEY, accessToken);
          this.accessTokenSig.set(accessToken);
          if (replacementRefreshToken) {
            this.storage.set(REFRESH_TOKEN_KEY, replacementRefreshToken);
            this.refreshTokenSig.set(replacementRefreshToken);
          }
        }),
        map(({ accessToken }) => accessToken),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.refreshRequest$ = request$;
    return request$;
  }

  ensureValidAdminSession(): Observable<boolean> {
    if (this.hasValidToken()) return of(this.hasRole('ADMIN'));
    if (!this.canRefresh()) return of(false);

    return this.refreshAccessToken().pipe(
      map(() => this.hasValidToken() && this.hasRole('ADMIN')),
      catchError(() => of(false)),
    );
  }

  hasValidToken(): boolean {
    const token = this.accessTokenSig();
    if (!token) return false;

    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    if (!payload?.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  }

  hasRole(role: string): boolean {
    const token = this.accessTokenSig();
    if (!token) return false;

    const payload = decodeJwtPayload(token);
    const roles: string[] = payload?.realm_access?.roles ?? [];
    return roles.includes(role);
  }
}
