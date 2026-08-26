import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { runtimeApiUrl } from '../config/runtime-config.service';
import {
  CartAvailabilityRequestDTO,
  CartAvailabilityResponseDTO,
  CreateOrderQuoteDTO,
  CreateUnregisteredOrderDTO,
  CreateUnregisteredOrderResponse,
  OrderQuoteDTO,
} from './orders.models';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);

  checkCartAvailability(
    payload: CartAvailabilityRequestDTO,
  ): Observable<CartAvailabilityResponseDTO> {
    return this.http.post<CartAvailabilityResponseDTO>(
      runtimeApiUrl('/orders/availability'),
      payload,
    );
  }

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
