import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CreateProductRequest,
  Product,
  SearchMainRequest,
  SearchMainResponse,
  SearchProductRequest,
  UpdateProductRequest,
  ProductVariant,
  CreateProductVariantDTO, UpdateProductVariantDTO,
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

    const body: SearchMainRequest = { searchQuery };

    return this.http.post<SearchMainResponse>(url, body, { }).pipe(
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

  /**
   * ===========================
   * DODATO ZA "DODAJ MODEL"
   * ===========================
   *
   * Lista modela (varijanti) za izabrani proizvod.
   *
   * BITNO: Pošto mi nisi poslao tačan backend endpoint, ovdje je ruta placeholder.
   * Ako tvoj backend ima drugačije, promijeni samo URL string ispod.
   */
  getVariantsByProductId(productId: string): Observable<ProductVariant[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const url = `${environment.apiBaseUrl}/products/admin/variants/by-product/${encodeURIComponent(productId)}`;

    return this.http.get<ProductVariant[]>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] getVariantsByProductId failed:', err);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Kreiranje varijante (modela) preko multipart/form-data:
   * - "variant" = JSON Blob (CreateProductVariantDTO)
   * - "images"  = File[] (webp/jpg/jpeg)
   *
   * BITNO: Ako backend očekuje druga imena polja, promijeni samo ključeve 'variant' i 'images'.
   */
  createVariantMultipart(dto: CreateProductVariantDTO, images: File[]) {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const formData = new FormData();

    const variantBlob = new Blob([JSON.stringify(dto)], { type: 'application/json' });
    formData.append('variant', variantBlob, 'variant.json');

    for (const img of images) {
      formData.append('images', img, img.name);
    }

    // BITNO: NIKAD ne setuj Content-Type za FormData
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    return this.http.post<ProductVariant>(
      `${environment.apiBaseUrl}/products/admin/variants`,
      formData,
      { headers },
    );
  }

  getVariantDetails(variantId: string): Observable<ProductVariant> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const url = `${environment.apiBaseUrl}/products/variants/${encodeURIComponent(variantId)}/details`;

    return this.http.get<ProductVariant>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] getVariantDetails failed:', err);
        return throwError(() => err);
      }),
    );
  }

  updateVariantMultipart(dto: UpdateProductVariantDTO, imagesToAdd: File[]): Observable<ProductVariant> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const formData = new FormData();

    formData.append('variant', new Blob([JSON.stringify(dto)], { type: 'application/json' }));

    for (const img of imagesToAdd ?? []) {
      formData.append('images', img, img.name);
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    return this.http.post<ProductVariant>(
      `${environment.apiBaseUrl}/products/admin/variants/update`,
      formData,
      { headers },
    ).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] updateVariantMultipart failed:', err);
        return throwError(() => err);
      }),
    );
  }

  deleteVariant(variantId: string): Observable<unknown> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const url = `${environment.apiBaseUrl}/products/admin/variants/${encodeURIComponent(variantId)}`;

    return this.http.delete(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminProductsApi] deleteVariant failed:', err);
        return throwError(() => err);
      }),
    );
  }

}
