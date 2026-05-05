import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  hasChildren?: boolean | null;
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
  const hasChildren = typeof raw?.hasChildren === 'boolean' ? raw.hasChildren : undefined;

  return { id, value, displayValue, parent, hasChildren };
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

  getCategoryValues(
    categoryId: string,
    options?: { onlyRoot?: boolean; onlyChildren?: boolean },
  ): Observable<ApiCategoryValue[]> {
    const onlyRoot = options?.onlyRoot === true;
    const onlyChildren = options?.onlyChildren === true;
    const cacheKey = `${categoryId}|root=${onlyRoot ? '1' : '0'}|children=${onlyChildren ? '1' : '0'}`;
    const existing = this.valuesCache.get(cacheKey);
    if (existing) return existing;

    let params = new HttpParams();
    if (onlyRoot) params = params.set('onlyRoot', 'true');
    if (onlyChildren) params = params.set('onlyChildren', 'true');

    const req$ = this.http
      .get<RawApiCategoryValue[]>(`${this.baseUrl}/categories/${categoryId}/values`, { params })
      .pipe(
        map((items) =>
          items
            .map(normalizeCategoryValue)
            .filter((item): item is ApiCategoryValue => item !== null),
        ),
        catchError((error) => {
          this.valuesCache.delete(cacheKey);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.valuesCache.set(cacheKey, req$);
    return req$;
  }

  getCategoryValueChildren(parentCategoryValueId: string): Observable<ApiCategoryValue[]> {
    const cacheKey = `children|${parentCategoryValueId}`;
    const existing = this.valuesCache.get(cacheKey);
    if (existing) return existing;

    const req$ = this.http
      .get<RawApiCategoryValue[]>(
        `${this.baseUrl}/categories/values/${parentCategoryValueId}/children`,
      )
      .pipe(
        map((items) =>
          items
            .map(normalizeCategoryValue)
            .filter((item): item is ApiCategoryValue => item !== null),
        ),
        catchError((error) => {
          this.valuesCache.delete(cacheKey);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.valuesCache.set(cacheKey, req$);
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
