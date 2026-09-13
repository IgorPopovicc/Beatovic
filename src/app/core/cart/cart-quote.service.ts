import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, defer, throwError } from 'rxjs';
import { catchError, debounceTime, filter, finalize, switchMap, take, takeUntil, tap } from 'rxjs/operators';

import { OrdersApiService } from '../api/orders-api.service';
import { CreateOrderQuoteDTO, OrderQuoteDTO } from '../api/orders.models';
import { TurnstileTokenService } from '../security/turnstile-token.service';
import { CartItem } from './cart.store';

type QuoteOptions = Pick<CreateOrderQuoteDTO, 'couponCode' | 'email'>;

// Scoped to the cart/checkout component so navigation cancels pending requests.
@Injectable()
export class CartQuoteService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly tokens = inject(TurnstileTokenService);
  private readonly token$ = toObservable(computed(() => this.tokens.token('checkout')));
  private readonly scheduled = new Subject<CreateOrderQuoteDTO | null>();
  private readonly cancelled = new Subject<void>();
  private readonly quotedKey = signal<string | null>(null);

  readonly quote = signal<OrderQuoteDTO | null>(null);
  readonly loading = signal(false);
  readonly waitingForVerification = signal(false);
  readonly error = signal<string | null>(null);
  readonly canCheckout = computed(() => this.quote() !== null && !this.loading() && !this.error());

  constructor() {
    this.scheduled.pipe(
      debounceTime(180),
      switchMap((payload) => payload ? this.token$.pipe(
        // Check the current token too: toObservable may still hold the consumed token.
        filter((token) => !!token && token === this.tokens.token('checkout')),
        take(1),
        switchMap(() => this.requestQuote(payload)),
        takeUntil(this.cancelled),
        catchError(() => EMPTY),
      ) : EMPTY),
      takeUntilDestroyed(),
    ).subscribe();
  }

  invalidate(): void {
    this.cancelled.next();
    this.scheduled.next(null);
    this.quotedKey.set(null);
    this.quote.set(null);
    this.loading.set(false);
    this.waitingForVerification.set(false);
    this.error.set(null);
  }

  scheduleValidation(items: CartItem[], options: QuoteOptions = {}): void {
    this.invalidate();
    if (!items.length) return;
    this.waitingForVerification.set(true);
    this.scheduled.next(this.payload(items, options));
  }

  validateNow(items: CartItem[], options: QuoteOptions = {}): Observable<OrderQuoteDTO> {
    return defer(() => {
      this.invalidate();
      return this.requestQuote(this.payload(items, options));
    });
  }

  matches(items: CartItem[], options: QuoteOptions = {}): boolean {
    return this.canCheckout() && this.quotedKey() === JSON.stringify(this.payload(items, options));
  }

  private payload(items: CartItem[], options: QuoteOptions): CreateOrderQuoteDTO {
    return {
      orderItems: items.map((item) => ({
        sizeVariantAttributeId: item.id.split('::')[0].trim(),
        quantity: item.qty,
      })),
      ...(options.couponCode ? { couponCode: options.couponCode } : {}),
      ...(options.email ? { email: options.email } : {}),
    };
  }

  private requestQuote(payload: CreateOrderQuoteDTO): Observable<OrderQuoteDTO> {
    if (!payload.orderItems.length || payload.orderItems.some((item) =>
      !item.sizeVariantAttributeId || !Number.isInteger(item.quantity) || item.quantity < 1
    )) {
      this.error.set('Stavke u korpi nisu ispravne. Uredite korpu prije naručivanja.');
      this.waitingForVerification.set(false);
      return throwError(() => new Error('Invalid cart items'));
    }
    if (!this.tokens.hasToken('checkout')) {
      this.waitingForVerification.set(true);
      this.error.set('Potvrdite sigurnosnu provjeru za obračun korpe.');
      return throwError(() => new Error('Missing Turnstile token'));
    }

    this.waitingForVerification.set(false);
    this.loading.set(true);
    return this.ordersApi.createOrderQuote(payload).pipe(
      tap((response) => {
        // Swagger has no per-item results. A complete successful quote validates the batch.
        if (!response || ![response.subtotal, response.discountAmount, response.totalPrice]
          .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
          (payload.couponCode && !response.couponCode?.trim())) {
          throw new Error('Incomplete order quote');
        }
        this.quote.set(response);
        this.quotedKey.set(JSON.stringify(payload));
      }),
      catchError((error: unknown) => {
        this.quote.set(null);
        this.quotedKey.set(null);
        this.error.set(error instanceof HttpErrorResponse && error.status === 400 &&
          typeof error.error === 'string' && error.error.trim()
          ? error.error.trim()
          : error instanceof HttpErrorResponse && error.status === 403
            ? 'Sigurnosna provjera nije uspjela. Potvrdite je ponovo.'
            : 'Trenutno nije moguće provjeriti dostupnost i obračun korpe. Pokušajte ponovo.');
        return throwError(() => error);
      }),
      takeUntil(this.cancelled),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading.set(false);
        // Tokens are single-use, including failures and cancelled HTTP requests.
        this.tokens.reset('checkout');
      }),
    );
  }
}
