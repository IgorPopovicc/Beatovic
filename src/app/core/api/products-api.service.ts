import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductsSearchRequest, ProductSearchResponse } from './catalog.models';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  search(body: ProductsSearchRequest): Observable<ProductSearchResponse> {
    const payload: ProductsSearchRequest = {
      page: 0,
      pageSize: 36,
      sortBy: 'NAME',
      sortOrder: 'ASC',
      ...body,
    };
    return this.http.post<ProductSearchResponse>(`${this.baseUrl}/products/search`, payload);
  }

  getVariantDetails(id: string) {
    return this.http.get<any>(`${environment.apiBaseUrl}/products/variants/${id}/details`);
  }
}
