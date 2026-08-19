import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductsSearchRequest, ProductSearchResponse, Variant } from './catalog.models';
import { Observable } from 'rxjs';
import { runtimeApiUrl } from '../config/runtime-config.service';

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
    };
    return this.http.post<ProductSearchResponse>(`${this.baseUrl}/products/search`, payload);
  }

  getVariantDetails(id: string): Observable<Variant> {
    return this.http.get<Variant>(
      runtimeApiUrl(`/products/variants/${encodeURIComponent(id)}/details`),
    );
  }
}
