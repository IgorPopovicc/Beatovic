import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { CatalogApiService } from './catalog-api.sevice';
import { ApiCategoryValue, AvailableCategory, ProductsSearchRequest } from './catalog.models';
import { ProductsApiService } from './products-api.service';

export type VisibleCategoryValue = ApiCategoryValue & {
  count: number;
  alreadySelected: boolean;
};

export interface ContextualCategoryChildrenRequest {
  categoryId: string;
  parentCategoryValueId: string;
  genderCategoryId?: string;
  genderValueId?: string;
  hasActiveStock?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class CategoryVisibilityService {
  private readonly catalogApi = inject(CatalogApiService);
  private readonly productsApi = inject(ProductsApiService);
  private readonly contextualChildrenCache = new Map<string, Observable<VisibleCategoryValue[]>>();

  getVisibleChildren(
    request: ContextualCategoryChildrenRequest,
  ): Observable<VisibleCategoryValue[]> {
    const categoryId = String(request.categoryId ?? '').trim();
    const parentCategoryValueId = String(request.parentCategoryValueId ?? '').trim();
    const genderCategoryId = String(request.genderCategoryId ?? '').trim();
    const genderValueId = String(request.genderValueId ?? '').trim();

    if (!categoryId || !parentCategoryValueId) {
      return throwError(() => new Error('Category visibility context is incomplete.'));
    }

    const stockKey = request.hasActiveStock === true ? 'in-stock' : 'all-stock';
    const cacheKey = [
      categoryId,
      parentCategoryValueId,
      genderCategoryId || 'all-genders',
      genderValueId || 'all-genders',
      stockKey,
    ].join('|');
    const cached = this.contextualChildrenCache.get(cacheKey);
    if (cached) return cached;

    const searchRequest: ProductsSearchRequest = {
      initialCategoryFilters: {},
      categoryFilters: { [categoryId]: [parentCategoryValueId] },
      page: 0,
      pageSize: 1,
      sortBy: 'NAME',
      sortOrder: 'ASC',
    };

    if (genderCategoryId && genderValueId) {
      searchRequest.initialCategoryFilters = { [genderCategoryId]: [genderValueId] };
    }
    if (request.hasActiveStock === true) {
      searchRequest.hasActiveStock = true;
    }

    const visibleChildren$ = forkJoin({
      rawChildren: this.catalogApi.getCategoryChildren(parentCategoryValueId),
      response: this.productsApi.search(searchRequest),
    }).pipe(
      map(({ rawChildren, response }) =>
        this.deriveVisibleChildren(categoryId, rawChildren, response.availableCategories),
      ),
      catchError((error) => {
        this.contextualChildrenCache.delete(cacheKey);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.contextualChildrenCache.set(cacheKey, visibleChildren$);
    return visibleChildren$;
  }

  deriveVisibleChildren(
    categoryId: string,
    rawChildren: readonly ApiCategoryValue[],
    availableCategories: readonly AvailableCategory[],
  ): VisibleCategoryValue[] {
    const contextualGroup = availableCategories.find((group) => group.id === categoryId);
    if (!contextualGroup) return [];

    const availableById = new Map(
      contextualGroup.values
        .filter((value) => Number(value.count ?? 0) > 0)
        .map((value) => [value.id, value] as const),
    );

    return rawChildren.flatMap((child) => {
      const available = availableById.get(child.id);
      if (!available) return [];

      return [
        {
          ...child,
          count: Number(available.count ?? 0),
          alreadySelected: available.alreadySelected === true,
        },
      ];
    });
  }
}
