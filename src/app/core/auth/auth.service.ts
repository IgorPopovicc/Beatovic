import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { KeycloakTokenResponse } from './auth.models';
import { BrowserStorage } from './storage';
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

  readonly isAuthenticated = computed(() => {
    const token = this.accessTokenSig();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
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
    return (
      payload?.preferred_username ??
      payload?.email ??
      payload?.name ??
      payload?.sub ??
      null
    );
  });

  login(username: string, password: string): Observable<void> {
    const url = `${environment.auth.host}/realms/${environment.auth.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: environment.auth.clientId,
      username,
      password,
    }).toString();

    return this.http
      .post<KeycloakTokenResponse>(url, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        timeout(15000),
        tap((res) => {
          this.storage.set(ACCESS_TOKEN_KEY, res.access_token);
          this.accessTokenSig.set(res.access_token);
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
