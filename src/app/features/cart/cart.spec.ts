import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartComponent } from './cart';
import { TurnstileTokenService } from '../../core/security/turnstile-token.service';

// Exercise stored-cart hydration, Angular effects, HTTP validation and rendered controls together.
describe('CartComponent', () => {
  let component: CartComponent;
  let fixture: ComponentFixture<CartComponent>;
  let http: HttpTestingController;
  let tokens: TurnstileTokenService;
  const id = '3f5b3dc6-cd77-4c61-bdb8-6646a5a9e5f8::XL';
  const storedItem = { id, productId: '438c5c58-fe44-4778-804b-d2fb2a79eb4b',
    name: 'ŠORC KAPPA', size: 'XL', qty: 1, unitPrice: { amount: 269, currency: 'BAM' } };
  const quote = { subtotal: 188.3, discountAmount: 0, totalPrice: 188.3 };
  const settle = async (): Promise<void> => {
    TestBed.tick();
    await new Promise<void>((resolve) => setTimeout(resolve, 220));
    TestBed.tick();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    window.localStorage.setItem('beatovic_cart_v1', JSON.stringify([storedItem]));
    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TurnstileTokenService);
    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    window.localStorage.removeItem('beatovic_cart_v1');
  });

  it('revalidates a stored cart, renders backend totals and blocks until verification succeeds', async () => {
    expect(component.items()[0].id).toBe(id);
    expect(component.canCheckout()).toBeFalse();
    expect(component.total().amount).toBeNull();
    tokens.setToken('checkout', 'cart-token');
    await settle();
    http.expectOne('/api/orders/quote').flush(quote);
    fixture.detectChanges();
    expect(component.canCheckout()).toBeTrue();
    expect(component.total().amount).toBe(188.3);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.sum-row.big')?.textContent).toContain('188.30');
  });

  it('keeps an unavailable stored item visible and shows the backend error without changing quantity', async () => {
    tokens.setToken('checkout', 'cart-token');
    await settle();
    http.expectOne('/api/orders/quote').flush('Odabrana veličina više nije dostupna.',
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Odabrana veličina više nije dostupna.');
    expect(root.querySelector('.table-body .name')?.textContent).toContain('ŠORC KAPPA');
    expect(root.querySelector<HTMLButtonElement>('.actions button.primary')?.disabled).toBeTrue();
    expect(component.items()[0].qty).toBe(1);
  });

  it('preserves decimal unit prices through quantity changes and formats floating-point line totals', async () => {
    for (const [amount, qty, displayed] of [[19.20, 2, '38.40'], [19.99, 3, '59.97'],
      [19.01, 2, '38.02'], [0.07, 3, '0.21']] as const) {
      component.cart.clear();
      component.cart.add({ ...storedItem, qty, unitPrice: { amount, currency: 'BAM' } });
      fixture.detectChanges();
      expect(component.items()[0].unitPrice.amount).toBe(amount);
      expect(fixture.nativeElement.querySelector('.row .total').textContent.trim()).toBe(`${displayed} KM`);
      component.increase(id);
      component.decrease(id);
      expect(component.items()[0].unitPrice.amount).toBe(amount);
      expect(component.items()[0].qty).toBe(qty);
    }

    tokens.setToken('checkout', 'decimal-quote-token');
    await settle();
    http.expectOne('/api/orders/quote').flush({ subtotal: 0.21, discountAmount: 0, totalPrice: 0.21 });
    fixture.detectChanges();
    expect(component.total().amount).toBe(0.21);
    expect(fixture.nativeElement.querySelector('.sum-row.big').textContent).toContain('0.21 KM');
    expect(fixture.nativeElement.querySelector('.free-title strong').textContent).toContain('99.78 KM');
  });

  it('requotes increases and decreases, then cancels validation when the last item is removed', async () => {
    tokens.setToken('checkout', 'initial-token');
    await settle();
    http.expectOne('/api/orders/quote').flush(quote);
    component.increase(id);
    expect(component.canCheckout()).toBeFalse();
    tokens.setToken('checkout', 'increase-token');
    await settle();
    const increase = http.expectOne('/api/orders/quote');
    expect(increase.request.body.orderItems[0].quantity).toBe(2);
    increase.flush('Nedovoljna količina na zalihama za proizvod SKU: 321M7QW-A03, veličina: XL.',
      { status: 400, statusText: 'Bad Request' });
    expect(component.items()[0].qty).toBe(2);
    expect(component.canCheckout()).toBeFalse();
    component.decrease(id);
    tokens.setToken('checkout', 'decrease-token');
    await settle();
    const decrease = http.expectOne('/api/orders/quote');
    expect(decrease.request.body.orderItems[0].quantity).toBe(1);
    decrease.flush(quote);
    expect(component.canCheckout()).toBeTrue();
    component.askRemove(id);
    component.confirmRemove();
    await settle();
    expect(component.count()).toBe(0);
    expect(component.quoteService.quote()).toBeNull();
    http.expectNone('/api/orders/quote');
  });
});
