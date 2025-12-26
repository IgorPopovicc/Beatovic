import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminOrder } from './admin-orders.models';

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

  // Placeholder endpoints for later (ako ih budeš imao)
  // completeOrder(orderId: string): Observable<unknown> { ... }
  // cancelOrder(orderId: string): Observable<unknown> { ... }
  // returnOrder(orderId: string): Observable<unknown> { ... }
}
