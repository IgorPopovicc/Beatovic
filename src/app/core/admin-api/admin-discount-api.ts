import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import {
  CreateDiscountRequest,
  DiscountListItem,
  UpdateDiscountRequest,
} from './admin-discount.model';
import { DiscountDTO } from './admin-products.models';

@Injectable({ providedIn: 'root' })
export class AdminDiscountsApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private headersOrThrow(): HttpHeaders | never {
    const token = this.auth.accessToken();
    if (!token) throw new Error('Nema tokena. Prijavite se kao admin.');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getAll(): Observable<DiscountListItem[]> {
    const url = `${environment.apiBaseUrl}/discounts/admin`;
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (e) {
      return throwError(() => e);
    }

    return this.http.get<DiscountListItem[]>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminDiscountsApi] getAll failed:', err);
        return throwError(() => err);
      }),
    );
  }

  create(body: CreateDiscountRequest): Observable<unknown> {
    const url = `${environment.apiBaseUrl}/discounts/admin`;
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (e) {
      return throwError(() => e);
    }

    return this.http.post(url, body, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminDiscountsApi] create failed:', err);
        return throwError(() => err);
      }),
    );
  }

  update(body: UpdateDiscountRequest): Observable<unknown> {
    const url = `${environment.apiBaseUrl}/discounts/admin`;
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (e) {
      return throwError(() => e);
    }

    return this.http.put(url, body, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminDiscountsApi] update failed:', err);
        return throwError(() => err);
      }),
    );
  }

  // Delete endpoint od 01.01.2026 koristi HTTP DELETE (path ostaje isti)
  delete(discountId: string): Observable<unknown> {
    const url = `${environment.apiBaseUrl}/discounts/admin/${discountId}/delete`;
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (e) {
      return throwError(() => e);
    }

    return this.http.delete(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminDiscountsApi] delete failed:', err);
        return throwError(() => err);
      }),
    );
  }

  getActiveDiscounts(): Observable<DiscountDTO[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    return this.http
      .get<DiscountDTO[]>(`${environment.apiBaseUrl}/discounts/admin`, { headers })
      .pipe(
        catchError((err) => {
          console.error('[AdminDiscountsApi] getActiveDiscounts failed:', err);
          return throwError(() => err);
        }),
      );
  }
}
