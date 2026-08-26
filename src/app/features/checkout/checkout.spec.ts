import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { OrdersApiService } from '../../core/api/orders-api.service';
import { CreateUnregisteredOrderDTO, OrderQuoteDTO } from '../../core/api/orders.models';
import { CartStore } from '../../core/cart/cart.store';
import { CartAvailabilityService } from '../../core/cart/cart-availability.service';
import { TurnstileTokenService } from '../../core/security/turnstile-token.service';
import { CheckoutComponent } from './checkout';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let cart: CartStore;
  let turnstile: TurnstileTokenService;
  let ordersApi: jasmine.SpyObj<OrdersApiService>;

  const successfulQuote = (overrides: Partial<OrderQuoteDTO> = {}): OrderQuoteDTO => ({
    subtotal: 120,
    discountAmount: 18,
    totalPrice: 102,
    couponCode: 'SAVE10',
    couponType: 'PERCENTAGE',
    couponValue: 15,
    ...overrides,
  });

  const addCartItem = (
    id = 'size-attribute-a::M',
    qty = 1,
    productId = 'variant-a',
  ): void => {
    cart.add({
      id,
      productId,
      name: 'Test proizvod',
      sku: `SKU-${productId}`,
      displaySku: `DISPLAY-${productId}`,
      size: id.split('::')[1] ?? null,
      unitPrice: { amount: 50, currency: 'BAM' },
      qty,
      maxQty: 10,
    });
    TestBed.flushEffects();
    TestBed.inject(CartAvailabilityService).validateNow(cart.items()).subscribe();
  };

  const prepareQuote = (couponCode = 'SAVE10', email = 'kupac@example.com'): void => {
    component.form.controls.email.setValue(email);
    component.form.controls.couponCode.setValue(couponCode);
    turnstile.setToken('checkout', 'quote-turnstile-token');
  };

  beforeEach(async () => {
    window.localStorage.removeItem('beatovic_cart_v1');
    ordersApi = jasmine.createSpyObj<OrdersApiService>('OrdersApiService', [
      'checkCartAvailability',
      'createOrderQuote',
      'createUnregisteredOrder',
    ]);
    ordersApi.checkCartAvailability.and.callFake((payload) =>
      of({
        valid: true,
        items: payload.items.map((item) => ({
          sizeVariantAttributeId: item.sizeVariantAttributeId,
          variantId: 'variant-a',
          requestedQuantity: item.quantity,
          availableQuantity: 10,
          available: true,
          reason: 'AVAILABLE' as const,
        })),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        { provide: OrdersApiService, useValue: ordersApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    cart = TestBed.inject(CartStore);
    turnstile = TestBed.inject(TurnstileTokenService);
    fixture.detectChanges();
    TestBed.flushEffects();
  });

  afterEach(() => window.localStorage.removeItem('beatovic_cart_v1'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends the current order snapshot and renders backend pricing as authoritative', () => {
    addCartItem('size-attribute-a::M', 2);
    prepareQuote('  Save10  ');
    ordersApi.createOrderQuote.and.returnValue(
      of(successfulQuote({ subtotal: 137, discountAmount: 23, totalPrice: 114 })),
    );

    component.applyCoupon();

    expect(ordersApi.createOrderQuote).toHaveBeenCalledOnceWith({
      email: 'kupac@example.com',
      couponCode: 'Save10',
      orderItems: [{ sizeVariantAttributeId: 'size-attribute-a', quantity: 2 }],
    });
    expect(component.originalTotal().amount).toBe(137);
    expect(component.discountAmount()).toBe(23);
    expect(component.total().amount).toBe(114);
    expect(component.appliedCoupon()?.code).toBe('SAVE10');
    expect(component.form.controls.couponCode.value).toBe('SAVE10');
    expect(turnstile.token('checkout')).toBeNull();

    fixture.detectChanges();
    const renderedText = String(fixture.nativeElement.textContent);
    expect(renderedText).toContain('Redovna cijena');
    expect(renderedText).toContain('Ukupno sa popustom');
  });

  it('shows the exact Serbian text/plain message from an HTTP 400 response', () => {
    addCartItem();
    prepareQuote('NEPOSTOJECI');
    ordersApi.createOrderQuote.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: 'Kupon ne postoji ili više nije aktivan.',
          }),
      ),
    );

    component.applyCoupon();

    expect(component.couponFeedback()).toEqual({
      kind: 'error',
      text: 'Kupon ne postoji ili više nije aktivan.',
    });
    expect(component.appliedCoupon()).toBeNull();
    expect(component.total().amount).toBe(50);

    fixture.detectChanges();
    expect(String(fixture.nativeElement.textContent)).toContain(
      'Kupon ne postoji ili više nije aktivan.',
    );
  });

  it('does not call the API for an empty coupon', () => {
    addCartItem();
    prepareQuote('   ');

    component.applyCoupon();

    expect(ordersApi.createOrderQuote).not.toHaveBeenCalled();
    expect(component.couponFeedback()?.text).toContain('Unesite kod kupona');
  });

  it('requires the checkout email and Turnstile token before requesting a quote', () => {
    addCartItem();
    component.form.controls.couponCode.setValue('SAVE10');

    component.applyCoupon();
    expect(ordersApi.createOrderQuote).not.toHaveBeenCalled();
    expect(component.couponFeedback()?.text).toContain('email adresu');

    component.form.controls.email.setValue('kupac@example.com');
    component.applyCoupon();
    expect(ordersApi.createOrderQuote).not.toHaveBeenCalled();
    expect(component.couponFeedback()?.text).toContain('sigurnosnu provjeru');
  });

  it('invalidates and requotes the same product with the updated quantity', () => {
    addCartItem('size-attribute-a::M', 1);
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValues(
      of(successfulQuote()),
      of(successfulQuote({ subtotal: 240, discountAmount: 36, totalPrice: 204 })),
    );

    component.applyCoupon();
    cart.setQty('size-attribute-a::M', 2);
    TestBed.flushEffects();
    component.availability.validateNow(cart.items()).subscribe();

    expect(component.appliedCoupon()).toBeNull();
    expect(component.quoteNeedsReapply()).toBeTrue();
    expect(component.couponFeedback()?.text).toContain('Korpa je izmijenjena');

    turnstile.setToken('checkout', 'new-quote-token');
    component.applyCoupon();

    expect(ordersApi.createOrderQuote.calls.mostRecent().args[0].orderItems).toEqual([
      { sizeVariantAttributeId: 'size-attribute-a', quantity: 2 },
    ]);
    expect(component.total().amount).toBe(204);
  });

  it('invalidates an applied quote when an item is removed', () => {
    addCartItem();
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValue(of(successfulQuote()));
    component.applyCoupon();

    cart.remove('size-attribute-a::M');
    TestBed.flushEffects();

    expect(component.appliedCoupon()).toBeNull();
    expect(component.quoteNeedsReapply()).toBeTrue();
  });

  it('invalidates an applied quote when the coupon or email changes', () => {
    addCartItem();
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValues(of(successfulQuote()), of(successfulQuote()));
    component.applyCoupon();

    component.form.controls.couponCode.setValue('SAVE20');
    expect(component.appliedCoupon()).toBeNull();
    expect(component.quoteNeedsReapply()).toBeTrue();

    turnstile.setToken('checkout', 'second-quote-token');
    component.applyCoupon();
    component.form.controls.email.setValue('drugi@example.com');

    expect(component.appliedCoupon()).toBeNull();
    expect(component.quoteNeedsReapply()).toBeTrue();
    expect(component.couponFeedback()?.text).toContain('Email je izmijenjen');
  });

  it('shows a safe message for network and server errors', () => {
    addCartItem();
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 503, error: 'internal stack trace' })),
    );

    component.applyCoupon();

    expect(component.couponFeedback()).toEqual({
      kind: 'error',
      text: 'Trenutno nije moguće provjeriti kupon. Pokušajte ponovo.',
    });
  });

  it('prevents duplicate parallel quote requests from rapid clicks', () => {
    const pendingQuote = new Subject<OrderQuoteDTO>();
    addCartItem();
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValue(pendingQuote);

    component.applyCoupon();
    component.applyCoupon();

    expect(component.couponApplying()).toBeTrue();
    expect(ordersApi.createOrderQuote).toHaveBeenCalledTimes(1);

    pendingQuote.next(successfulQuote());
    pendingQuote.complete();
    expect(component.couponApplying()).toBeFalse();
  });

  it('does not apply a stale async response after the cart changes', () => {
    const pendingQuote = new Subject<OrderQuoteDTO>();
    addCartItem();
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValue(pendingQuote);
    component.applyCoupon();

    cart.setQty('size-attribute-a::M', 2);
    TestBed.flushEffects();
    pendingQuote.next(successfulQuote());
    pendingQuote.complete();

    expect(component.appliedCoupon()).toBeNull();
    expect(component.quoteNeedsReapply()).toBeTrue();
  });

  it('keeps different variants as distinct quote items', () => {
    addCartItem('size-attribute-a::M', 1, 'variant-a');
    addCartItem('size-attribute-b::M', 3, 'variant-b');
    prepareQuote();
    ordersApi.createOrderQuote.and.returnValue(of(successfulQuote()));

    component.applyCoupon();

    expect(ordersApi.createOrderQuote.calls.mostRecent().args[0].orderItems).toEqual([
      { sizeVariantAttributeId: 'size-attribute-a', quantity: 1 },
      { sizeVariantAttributeId: 'size-attribute-b', quantity: 3 },
    ]);
  });

  it('sends only the successfully quoted coupon with the final order', () => {
    const pendingOrder = new Subject<never>();
    addCartItem('size-attribute-a::M', 2);
    prepareQuote('typed-code');
    ordersApi.createOrderQuote.and.returnValue(
      of(successfulQuote({ couponCode: 'CONFIRMED-CODE' })),
    );
    ordersApi.createUnregisteredOrder.and.returnValue(pendingOrder);
    component.applyCoupon();

    component.form.patchValue({
      fullName: 'Amar Hadžić',
      email: 'kupac@example.com',
      phoneNumber: '+387 61 123 456',
      address: 'Testna 1',
      municipality: 'Sarajevo',
      postalCode: '71000',
      privacyPolicyAccepted: true,
    });
    turnstile.setToken('checkout', 'order-turnstile-token');

    component.submit();

    const payload = ordersApi.createUnregisteredOrder.calls.mostRecent()
      .args[0] as CreateUnregisteredOrderDTO;
    expect(payload.couponCode).toBe('CONFIRMED-CODE');
    expect(payload.orderItems).toEqual([
      { sizeVariantAttributeId: 'size-attribute-a', quantity: 2 },
    ]);
    expect(ordersApi.checkCartAvailability).toHaveBeenCalled();
  });

  it('keeps the cart and refreshes unavailable rows after a final-order stock conflict', () => {
    addCartItem('size-attribute-a::M', 2);
    component.form.patchValue({
      fullName: 'Amar Hadžić',
      email: 'kupac@example.com',
      phoneNumber: '+387 61 123 456',
      address: 'Testna 1',
      municipality: 'Sarajevo',
      postalCode: '71000',
      privacyPolicyAccepted: true,
    });
    turnstile.setToken('checkout', 'order-turnstile-token');
    ordersApi.createUnregisteredOrder.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'INVENTORY_CONFLICT', message: 'Insufficient stock' },
          }),
      ),
    );
    ordersApi.checkCartAvailability.and.returnValues(
      of({
        valid: true,
        items: [{
          sizeVariantAttributeId: 'size-attribute-a',
          variantId: 'variant-a',
          requestedQuantity: 2,
          availableQuantity: 10,
          available: true,
          reason: 'AVAILABLE',
        }],
      }),
      of({
        valid: false,
        items: [{
          sizeVariantAttributeId: 'size-attribute-a',
          variantId: 'variant-a',
          requestedQuantity: 2,
          availableQuantity: 1,
          available: false,
          reason: 'INSUFFICIENT_QUANTITY',
        }],
      }),
    );

    component.submit();

    expect(cart.itemsCount()).toBe(2);
    expect(component.errorMsg()).toContain('Zaliha se promijenila');
    expect(component.availability.messageFor(cart.items()[0])).toBe(
      'Dostupna količina je sada 1.',
    );
  });
});
