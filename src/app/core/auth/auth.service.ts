import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminLoginResponse } from './auth.models';
import { decodeJwtPayload } from './jwt';
import { map, tap, timeout } from 'rxjs/operators';
import { catchError, Observable, throwError } from 'rxjs';
import { BrowserStorageService } from './browser-storage.service';

const ACCESS_TOKEN_KEY = 'ps_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(BrowserStorageService);

  private readonly accessTokenSig = signal<string | null>(this.storage.get(ACCESS_TOKEN_KEY));
  readonly accessToken = this.accessTokenSig.asReadonly();

  constructor() {
    // Cleanup stale/malformed/expired tokens from previous sessions.
    if (this.accessTokenSig() && !this.hasValidToken()) {
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
    const url = `${environment.auth.host}/planetabih-webservice/api/auth/admin-panel/login`;
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
    this.accessTokenSig.set(null);
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
