import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  AdminOrder,
  OrdersByEmailRequest,
  UnregisteredOrderRequest,
  UnregisteredOrderResponse,
} from './admin-orders.models';

export interface UpdateOrderItemRequest {
  sizeAttributeVariantId: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class AdminOrdersApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  getByDate(startDate: string, endDate: string): Observable<AdminOrder[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const url =
      `${environment.apiBaseUrl}/orders/admin/by-date` +
      `?startDate=${encodeURIComponent(startDate)}` +
      `&endDate=${encodeURIComponent(endDate)}`;

    return this.http.get<AdminOrder[]>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] getByDate failed:', err);
        return throwError(() => err);
      }),
    );
  }

  getByEmailUnregistered(email: string): Observable<AdminOrder[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const url = `${environment.apiBaseUrl}/orders/admin/by-email/unregistered`;
    const payload: OrdersByEmailRequest = { email };

    return this.http.post<AdminOrder[]>(url, payload, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] getByEmailUnregistered failed:', err);
        return throwError(() => err);
      }),
    );
  }

  createUnregisteredOrder(
    payload: UnregisteredOrderRequest,
  ): Observable<UnregisteredOrderResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const url = `${environment.apiBaseUrl}/orders/unregistered`;

    return this.http.post<UnregisteredOrderResponse>(url, payload, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] createUnregisteredOrder failed:', err);
        return throwError(() => err);
      }),
    );
  }

  completeOrder(orderId: string): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const safeOrderId = encodeURIComponent(orderId);
    const url = `${environment.apiBaseUrl}/orders/admin/${safeOrderId}/complete`;

    return this.http.get<unknown>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] completeOrder failed:', err);
        return throwError(() => err);
      }),
    );
  }

  cancelOrder(orderId: string): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const safeOrderId = encodeURIComponent(orderId);
    const url = `${environment.apiBaseUrl}/orders/admin/${safeOrderId}/cancel`;

    return this.http.get<unknown>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] cancelOrder failed:', err);
        return throwError(() => err);
      }),
    );
  }

  resendConfirmation(orderId: string): Observable<void> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const safeOrderId = encodeURIComponent(orderId);
    const url = `${environment.apiBaseUrl}/orders/admin/${safeOrderId}/resend-confirmation`;

    return this.http.post(url, null, { headers, responseType: 'text' }).pipe(
      map(() => void 0),
      catchError((err) => {
        console.error('[AdminOrdersApi] resendConfirmation failed:', err);
        return throwError(() => err);
      }),
    );
  }

  updateOrderItems(orderId: string, items: UpdateOrderItemRequest[]): Observable<AdminOrder> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const safeOrderId = encodeURIComponent(orderId);
    const url = `${environment.apiBaseUrl}/orders/admin/${safeOrderId}/update-items`;

    return this.http.put<AdminOrder>(url, items, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] updateOrderItems failed:', err);
        return throwError(() => err);
      }),
    );
  }

  anonymizeCustomerByEmail(email: string): Observable<void> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const params = new HttpParams().set('email', email);
    const url = `${environment.apiBaseUrl}/anonymization/admin/customer`;

    return this.http.post(url, null, { headers, params, responseType: 'text' }).pipe(
      map(() => void 0),
      catchError((err) => {
        console.error('[AdminOrdersApi] anonymizeCustomerByEmail failed:', err);
        return throwError(() => err);
      }),
    );
  }
}
