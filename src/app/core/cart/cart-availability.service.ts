import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, defer, of, throwError } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap, tap } from 'rxjs/operators';

import { OrdersApiService } from '../api/orders-api.service';
import {
  CartAvailabilityResponseDTO,
  CartItemAvailabilityDTO,
  CreateOrderItemDTO,
} from '../api/orders.models';
import { CartItem } from './cart.store';

type ScheduledValidation = { token: number; items: CartItem[] };

@Injectable({ providedIn: 'root' })
export class CartAvailabilityService {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly scheduled = new Subject<ScheduledValidation>();
  private validationToken = 0;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly valid = signal<boolean | null>(null);
  readonly results = signal<Record<string, CartItemAvailabilityDTO>>({});
  readonly canCheckout = computed(
    () => this.valid() === true && !this.loading() && this.error() === null,
  );

  constructor() {
    this.scheduled
      .pipe(
        debounceTime(180),
        switchMap(({ token, items }) => {
          if (token !== this.validationToken) return EMPTY;
          return this.runValidation(token, items).pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  scheduleValidation(items: CartItem[]): void {
    const snapshot = items.map((item) => ({ ...item }));
    const token = ++this.validationToken;

    if (snapshot.length === 0) {
      this.applyResponse(token, { valid: true, items: [] }, 0);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.valid.set(null);
    this.scheduled.next({ token, items: snapshot });
  }

  validateNow(items: CartItem[]): Observable<CartAvailabilityResponseDTO> {
    const snapshot = items.map((item) => ({ ...item }));
    const token = ++this.validationToken;
    return this.runValidation(token, snapshot);
  }

  resultFor(item: CartItem): CartItemAvailabilityDTO | null {
    return this.results()[this.sizeAttributeId(item)] ?? null;
  }

  isUnavailable(item: CartItem): boolean {
    return this.resultFor(item)?.available === false;
  }

  messageFor(item: CartItem): string {
    const result = this.resultFor(item);
    if (!result || result.available) return '';

    if (result.reason === 'INSUFFICIENT_QUANTITY') {
      return `Dostupna količina je sada ${result.availableQuantity}.`;
    }
    if (result.reason === 'INVALID_QUANTITY') {
      return 'Izabrana količina nije ispravna.';
    }
    return 'Ovaj proizvod više nije dostupan.';
  }

  private runValidation(
    token: number,
    items: CartItem[],
  ): Observable<CartAvailabilityResponseDTO> {
    if (items.length === 0) {
      const response: CartAvailabilityResponseDTO = { valid: true, items: [] };
      this.applyResponse(token, response, 0);
      return of(response);
    }

    return defer(() => {
      if (token === this.validationToken) {
        this.loading.set(true);
        this.error.set(null);
        this.valid.set(null);
      }

      const requestItems = this.toRequestItems(items);
      return this.ordersApi.checkCartAvailability({ items: requestItems }).pipe(
        tap((response) => this.applyResponse(token, response, requestItems.length)),
        catchError((error: unknown) => {
          if (token === this.validationToken) {
            this.results.set({});
            this.valid.set(null);
            this.error.set('Trenutno nije moguće provjeriti dostupnost proizvoda.');
          }
          return throwError(() => error);
        }),
        finalize(() => {
          if (token === this.validationToken) this.loading.set(false);
        }),
      );
    });
  }

  private applyResponse(
    token: number,
    response: CartAvailabilityResponseDTO,
    requestedItemCount: number,
  ): void {
    if (token !== this.validationToken) return;

    const responseItems = Array.isArray(response.items) ? response.items : [];
    const byId: Record<string, CartItemAvailabilityDTO> = {};
    responseItems.forEach((item) => {
      if (item?.sizeVariantAttributeId) byId[item.sizeVariantAttributeId] = item;
    });

    const complete = responseItems.length === requestedItemCount;
    this.results.set(byId);
    this.valid.set(
      complete ? response.valid && responseItems.every((item) => item.available) : null,
    );
    this.error.set(
      complete ? null : 'Servis nije vratio potpunu provjeru dostupnosti proizvoda.',
    );
    this.loading.set(false);
  }

  private toRequestItems(items: CartItem[]): CreateOrderItemDTO[] {
    return items.map((item) => ({
      sizeVariantAttributeId: this.sizeAttributeId(item),
      quantity: item.qty,
    }));
  }

  private sizeAttributeId(item: CartItem): string {
    return String(item.id).split('::')[0].trim();
  }
}
