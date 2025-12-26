import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CreateProductRequest, Product,
  SearchMainRequest,
  SearchMainResponse,
  SearchProductRequest, UpdateProductRequest
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

  searchProduct(searchQuery: string): Observable<Product[]> {
    const url = `${environment.apiBaseUrl}/products/search-product`;

    const token = this.auth.accessToken();
    if (!token) {
      return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const body: SearchProductRequest = { searchQuery };

    return this.http.post<Product[]>(url, body, { headers }).pipe(
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

  updateProduct(body: UpdateProductRequest): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http.put(`${environment.apiBaseUrl}/products/admin`, body, { headers });
  }

  deleteProduct(id: string): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http
      .delete(`${environment.apiBaseUrl}/products/admin/${encodeURIComponent(id)}`, { headers })
      .pipe(
        catchError((err) => {
          console.error('[AdminProductsApi] deleteProduct failed:', err);
          return throwError(() => err);
        }),
      );
  }

}
