import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { runtimeApiUrl } from '../config/runtime-config.service';
import {
  CreateOrderQuoteDTO,
  CreateUnregisteredOrderDTO,
  CreateUnregisteredOrderResponse,
  OrderQuoteDTO,
} from './orders.models';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);

  createOrderQuote(payload: CreateOrderQuoteDTO): Observable<OrderQuoteDTO> {
    return this.http.post<OrderQuoteDTO>(runtimeApiUrl('/orders/quote'), payload);
  }

  createUnregisteredOrder(
    payload: CreateUnregisteredOrderDTO,
  ): Observable<CreateUnregisteredOrderResponse> {
    return this.http.post<CreateUnregisteredOrderResponse>(
      runtimeApiUrl('/orders/unregistered'),
      payload,
    );
  }
}
