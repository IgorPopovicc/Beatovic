import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CartQuoteService } from './cart-quote.service';
import { CartItem } from './cart.store';
import { TurnstileTokenService } from '../security/turnstile-token.service';
import { turnstileInterceptor } from '../security/turnstile.interceptor';

// Responses use the published OrderQuoteDTO / HTTP 400 text/plain contract.
describe('CartQuoteService', () => {
  let service: CartQuoteService;
  let http: HttpTestingController;
  let tokens: TurnstileTokenService;
  const item: CartItem = {
    id: '3f5b3dc6-cd77-4c61-bdb8-6646a5a9e5f8::XL',
    productId: '438c5c58-fe44-4778-804b-d2fb2a79eb4b',
    name: 'ŠORC KAPPA', size: 'XL', qty: 1,
    unitPrice: { amount: 269, currency: 'BAM' },
  };
  const quote = { subtotal: 188.3, discountAmount: 0, totalPrice: 188.3, couponCode: null };
  const settle = async (): Promise<void> => {
    TestBed.tick();
    await new Promise<void>((resolve) => setTimeout(resolve, 220));
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptors([turnstileInterceptor])), provideHttpClientTesting(),
      CartQuoteService,
    ] });
    service = TestBed.inject(CartQuoteService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TurnstileTokenService);
    tokens.setToken('checkout', 'fresh-token');
  });
  afterEach(() => http.verify());

  it('validates an available item with its size ID and a single-use token, using server totals', () => {
    service.validateNow([item]).subscribe();
    const request = http.expectOne('/api/orders/quote');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Turnstile-Token')).toBe('fresh-token');
    expect(request.request.body).toEqual({ orderItems: [{
      sizeVariantAttributeId: item.id.split('::')[0], quantity: 1,
    }] });
    request.flush(quote);
    expect(service.quote()).toEqual(quote);
    expect(service.matches([item])).toBeTrue();
    expect(tokens.hasToken('checkout')).toBeFalse();
  });

  it('sends multiple items without merging different sizes or variants', () => {
    const second = { ...item, id: 'fd79e407-10d6-4229-88e1-eb26cad21fb1::M', qty: 2 };
    service.validateNow([item, second]).subscribe();
    const request = http.expectOne('/api/orders/quote');
    expect(request.request.body.orderItems).toEqual([
      { sizeVariantAttributeId: item.id.split('::')[0], quantity: 1 },
      { sizeVariantAttributeId: second.id.split('::')[0], quantity: 2 },
    ]);
    request.flush(quote);
    expect(service.matches([item, second])).toBeTrue();
    expect(service.matches([item])).toBeFalse();
    expect(service.matches([{ ...item, qty: 2 }, second])).toBeFalse();
  });

  it('debounces quantity changes and waits for verification without a token loop', async () => {
    tokens.invalidate('checkout');
    service.scheduleValidation([item]);
    service.scheduleValidation([{ ...item, qty: 3 }]);
    service.scheduleValidation([{ ...item, qty: 2 }]);
    await settle();
    http.expectNone('/api/orders/quote');
    expect(service.waitingForVerification()).toBeTrue();
    expect(service.canCheckout()).toBeFalse();
    tokens.setToken('checkout', 'verified-token');
    await settle();
    const request = http.expectOne('/api/orders/quote');
    expect(request.request.body.orderItems[0].quantity).toBe(2);
    request.flush(quote);
    tokens.setToken('checkout', 'next-order-token');
    await settle();
    http.expectNone('/api/orders/quote');
    expect(tokens.token('checkout')).toBe('next-order-token');
  });

  it('cancels an old request when an item is removed and requires a fresh token', async () => {
    service.validateNow([item]).subscribe();
    const request = http.expectOne('/api/orders/quote');
    service.scheduleValidation([]);
    expect(request.cancelled).toBeTrue();
    expect(tokens.hasToken('checkout')).toBeFalse();
    expect(service.quote()).toBeNull();
    await settle();
    http.expectNone('/api/orders/quote');
  });

  it('does not duplicate an explicit coupon quote with an earlier scheduled request', async () => {
    service.scheduleValidation([item]);
    service.validateNow([item], { couponCode: 'WELCOME10', email: 'kupac@example.com' }).subscribe();
    const request = http.expectOne('/api/orders/quote');
    expect(request.request.body.couponCode).toBe('WELCOME10');
    request.flush({ subtotal: 180, discountAmount: 18, totalPrice: 162,
      couponCode: 'WELCOME10', couponType: 'PERCENTAGE', couponValue: 10 });
    tokens.setToken('checkout', 'next-token');
    await settle();
    http.expectNone('/api/orders/quote');
  });

  for (const message of [
    'Nedovoljna količina na zalihama za proizvod SKU: ABC-123, veličina: M.',
    'Kupon ne postoji ili više nije aktivan.',
  ]) {
    it(`blocks ordering and preserves cart contents on HTTP 400: ${message}`, () => {
      const snapshot = { ...item, qty: 3 };
      service.validateNow([snapshot]).subscribe({ error: () => undefined });
      http.expectOne('/api/orders/quote').flush(message, { status: 400, statusText: 'Bad Request' });
      expect(service.error()).toBe(message);
      expect(service.canCheckout()).toBeFalse();
      expect(service.quote()).toBeNull();
      expect(snapshot.qty).toBe(3);
    });
  }

  for (const status of [0, 403, 500]) {
    it(`fails closed and consumes the token on HTTP ${status}`, () => {
      service.validateNow([item]).subscribe({ error: (error: unknown) => {
        expect(error instanceof HttpErrorResponse).toBeTrue();
      } });
      const request = http.expectOne('/api/orders/quote');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush('private server information', { status, statusText: 'Error' });
      expect(service.canCheckout()).toBeFalse();
      expect(service.error()).not.toContain('private server information');
      expect(service.error()).toBeTruthy();
      expect(tokens.hasToken('checkout')).toBeFalse();
    });
  }

  it('rejects incomplete quote totals instead of falling back to local prices', () => {
    service.validateNow([item]).subscribe({ error: () => undefined });
    http.expectOne('/api/orders/quote').flush({ subtotal: 188.3 });
    expect(service.quote()).toBeNull();
    expect(service.canCheckout()).toBeFalse();
  });

  it('does not send empty carts or invalid quantities', () => {
    for (const items of [[], [{ ...item, qty: 0 }], [{ ...item, qty: 1.5 }]]) {
      service.validateNow(items).subscribe({ error: () => undefined });
    }
    http.expectNone('/api/orders/quote');
    expect(service.canCheckout()).toBeFalse();
  });
});
