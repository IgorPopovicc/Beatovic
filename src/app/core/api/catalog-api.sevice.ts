import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { ApiCategory, ApiCategoryValue } from './catalog.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  private categories$?: Observable<ApiCategory[]>;

  getCategories(): Observable<ApiCategory[]> {
    if (!this.categories$) {
      this.categories$ = this.http.get<ApiCategory[]>(`${this.baseUrl}/categories`).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.categories$;
  }

  getCategoryIdByName(name: string): Observable<string | null> {
    const target = name.trim().toUpperCase();
    return this.getCategories().pipe(
      map((cats) => cats.find((c) => c.name?.toUpperCase() === target)?.id ?? null)
    );
  }

  private valuesCache = new Map<string, Observable<ApiCategoryValue[]>>();

  getCategoryValues(categoryId: string): Observable<ApiCategoryValue[]> {
    const existing = this.valuesCache.get(categoryId);
    if (existing) return existing;

    const req$ = this.http
      .get<ApiCategoryValue[]>(`${this.baseUrl}/categories/${categoryId}/values`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));

    this.valuesCache.set(categoryId, req$);
    return req$;
  }

  getCategoryValuesByName(name: string): Observable<{ categoryId: string; values: ApiCategoryValue[] } | null> {
    return this.getCategoryIdByName(name).pipe(
      switchMap((id) => {
        if (!id) return of(null);
        return this.getCategoryValues(id).pipe(map((values) => ({ categoryId: id, values })));
      })
    );
  }
}
