import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CreateProductRequest,
  SearchMainRequest,
  SearchMainResponse,
  SearchProductRequest, SearchProductResponse
} from './admin-products.models';

@Injectable({ providedIn: 'root' })
export class AdminProductsApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  searchMain(searchQuery: string): Observable<SearchMainResponse> {
    const url = `${environment.apiBaseUrl}/products/search-main`;

    const token = this.auth.accessToken();
    if (!token) {
      return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body: SearchMainRequest = { searchQuery };

    return this.http.post<SearchMainResponse>(url, body, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] searchMain failed:', err);
        return throwError(() => err);
      }),
    );
  }

  searchProduct(searchQuery: string): Observable<SearchProductResponse> {
    const url = `${environment.apiBaseUrl}/products/search-product`;

    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body: SearchProductRequest = { searchQuery };

    return this.http.post<SearchProductResponse>(url, body, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] searchProduct failed:', err);
        return throwError(() => err);
      }),
    );
  }

  createProduct(body: CreateProductRequest): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) {
      return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    return this.http.post(`${environment.apiBaseUrl}/products/admin`, body, { headers });
  }
}
