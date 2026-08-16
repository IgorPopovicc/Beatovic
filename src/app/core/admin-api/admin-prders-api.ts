import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { runtimeApiUrl } from '../config/runtime-config.service';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  AdminOrder,
  OrdersByEmailRequest,
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

    const url = runtimeApiUrl(`/orders/admin/by-date`);
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);

    return this.http.get<AdminOrder[]>(url, { headers, params }).pipe(
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

    const url = runtimeApiUrl(`/orders/admin/by-email/unregistered`);
    const payload: OrdersByEmailRequest = { email };

    return this.http.post<AdminOrder[]>(url, payload, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] getByEmailUnregistered failed:', err);
        return throwError(() => err);
      }),
    );
  }

  getByOrderNumber(orderNumber: string): Observable<AdminOrder> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const safeOrderNumber = encodeURIComponent(orderNumber.trim());
    return this.http
      .get<AdminOrder>(
        runtimeApiUrl(`/orders/admin/by-number/${safeOrderNumber}`),
        { headers },
      )
      .pipe(
        catchError((err) => {
          console.error('[AdminOrdersApi] getByOrderNumber failed:', err);
          return throwError(() => err);
        }),
      );
  }

  getByPantheonId(pantheonOrderId: string): Observable<AdminOrder> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const safePantheonOrderId = encodeURIComponent(pantheonOrderId.trim());
    return this.http
      .get<AdminOrder>(
        runtimeApiUrl(`/orders/admin/by-pantheon-id/${safePantheonOrderId}`),
        { headers },
      )
      .pipe(
        catchError((err) => {
          console.error('[AdminOrdersApi] getByPantheonId failed:', err);
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
    const url = runtimeApiUrl(`/orders/admin/${safeOrderId}/complete`);

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
    const url = runtimeApiUrl(`/orders/admin/${safeOrderId}/cancel`);

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
    const url = runtimeApiUrl(`/orders/admin/${safeOrderId}/resend-confirmation`);

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
    const url = runtimeApiUrl(`/orders/admin/${safeOrderId}/update-items`);

    return this.http.put<AdminOrder>(url, items, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminOrdersApi] updateOrderItems failed:', err);
        return throwError(() => err);
      }),
    );
  }

  removeOrderCoupon(orderId: string): Observable<AdminOrder> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const safeOrderId = encodeURIComponent(orderId);
    return this.http
      .delete<AdminOrder>(runtimeApiUrl(`/orders/admin/${safeOrderId}/coupon`), { headers })
      .pipe(
        catchError((err) => {
          console.error('[AdminOrdersApi] removeOrderCoupon failed:', err);
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
    const url = runtimeApiUrl(`/anonymization/admin/customer`);

    return this.http.post(url, null, { headers, params, responseType: 'text' }).pipe(
      map(() => void 0),
      catchError((err) => {
        console.error('[AdminOrdersApi] anonymizeCustomerByEmail failed:', err);
        return throwError(() => err);
      }),
    );
  }
}
