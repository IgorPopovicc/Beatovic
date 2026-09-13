import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductsSearchRequest, ProductSearchResponse, Variant } from './catalog.models';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { runtimeApiUrl } from '../config/runtime-config.service';
import { hasProductStock } from './product-stock';

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = runtimeApiUrl('');

  search(body: ProductsSearchRequest): Observable<ProductSearchResponse> {
    const payload: ProductsSearchRequest = {
      page: 0,
      pageSize: 36,
      sortBy: 'PRIORITY',
      sortOrder: 'DESC',
      ...body,
      hasActiveStock: true,
    };
    return this.http.post<ProductSearchResponse>(`${this.baseUrl}/products/search`, payload).pipe(
      // Filter before pagination on the backend; this guard also rejects stale/unavailable rows.
      map((response) => ({ ...response, variants: response.variants.filter(hasProductStock) })),
    );
  }

  getVariantDetails(id: string): Observable<Variant | null> {
    return this.loadAvailableVariant(id).pipe(
      switchMap((variant) => {
        if (!variant) return of(null);
        // RelatedProductModelsDTO has only id/images, no stock or prices. Hydrate those
        // variants through the same stock gate before exposing them to the storefront.
        const relatedIds = [...new Set((variant.relatedProducts ?? []).map((related) => related.id))]
          .filter((relatedId) => !!relatedId && relatedId !== id);
        if (!relatedIds.length) return of({ ...variant, relatedProducts: [] });
        return forkJoin(relatedIds.map((relatedId) => this.loadAvailableVariant(relatedId).pipe(
          catchError(() => of(null)),
        ))).pipe(map((related) => ({
          ...variant,
          relatedProducts: related.filter((product): product is Variant => product !== null).map((product) => {
            const image = product.images?.find((image) => image.displayed) ?? product.images?.[0];
            return { ...product, mainImageWebUrl: image?.webUrl, mainImageThumbnailUrl: image?.thumbnailUrl };
          }),
        })));
      }),
    );
  }

  private loadAvailableVariant(id: string): Observable<Variant | null> {
    return this.http.get<Variant>(
      runtimeApiUrl(`/products/variants/${encodeURIComponent(id)}/details`),
    ).pipe(
      map((variant) => hasProductStock(variant) ? variant : null),
    );
  }
}
