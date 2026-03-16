import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { ApiCategory, ApiCategoryValue } from './catalog.models';
import { environment } from '../../../environments/environment';

type RawApiCategory = Partial<ApiCategory> & {
  id?: string;
  name?: string | null;
  displayName?: string | null;
  value?: string | null;
};

type RawApiCategoryValue = Partial<ApiCategoryValue> & {
  id?: string;
  value?: string | null;
  displayValue?: string | null;
  parent?: {
    id?: string;
    value?: string | null;
    displayValue?: string | null;
  } | null;
};

function normalizeCategory(raw: RawApiCategory): ApiCategory | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const name = String(raw?.name ?? raw?.displayName ?? raw?.value ?? '').trim();
  if (!name) return null;

  return { id, name };
}

function normalizeCategoryValue(raw: RawApiCategoryValue): ApiCategoryValue | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  // Backend can return either `value` or `displayValue` depending on API version.
  const value = String(raw?.displayValue ?? raw?.value ?? '').trim();
  if (!value) return null;

  const displayValue = String(raw?.displayValue ?? '').trim() || undefined;
  const parent = raw?.parent
    ? {
        id: String(raw.parent.id ?? '').trim() || undefined,
        value: String(raw.parent.value ?? '').trim() || undefined,
        displayValue: String(raw.parent.displayValue ?? '').trim() || undefined,
      }
    : null;

  return { id, value, displayValue, parent };
}

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  private categories$?: Observable<ApiCategory[]>;

  getCategories(): Observable<ApiCategory[]> {
    if (!this.categories$) {
      this.categories$ = this.http
        .get<RawApiCategory[]>(`${this.baseUrl}/categories`)
        .pipe(
          map((items) =>
            items.map(normalizeCategory).filter((item): item is ApiCategory => item !== null),
          ),
          catchError((error) => {
            this.categories$ = undefined;
            return throwError(() => error);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.categories$;
  }

  getCategoryIdByName(name: string): Observable<string | null> {
    const target = name.trim().toUpperCase();
    return this.getCategories().pipe(
      map((cats) => cats.find((c) => c.name?.toUpperCase() === target)?.id ?? null),
    );
  }

  private valuesCache = new Map<string, Observable<ApiCategoryValue[]>>();

  getCategoryValues(categoryId: string): Observable<ApiCategoryValue[]> {
    const existing = this.valuesCache.get(categoryId);
    if (existing) return existing;

    const req$ = this.http
      .get<RawApiCategoryValue[]>(`${this.baseUrl}/categories/${categoryId}/values`)
      .pipe(
        map((items) =>
          items
            .map(normalizeCategoryValue)
            .filter((item): item is ApiCategoryValue => item !== null),
        ),
        catchError((error) => {
          this.valuesCache.delete(categoryId);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.valuesCache.set(categoryId, req$);
    return req$;
  }

  getCategoryValuesByName(
    name: string,
  ): Observable<{ categoryId: string; values: ApiCategoryValue[] } | null> {
    return this.getCategoryIdByName(name).pipe(
      switchMap((id) => {
        if (!id) return of(null);
        return this.getCategoryValues(id).pipe(map((values) => ({ categoryId: id, values })));
      }),
    );
  }
}
