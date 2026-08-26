import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { OrdersApiService } from '../api/orders-api.service';
import { CartAvailabilityService } from './cart-availability.service';
import { CartItem } from './cart.store';

describe('CartAvailabilityService', () => {
  let service: CartAvailabilityService;
  let api: jasmine.SpyObj<OrdersApiService>;

  const item: CartItem = {
    id: 'size-attribute-id::42',
    productId: 'variant-id',
    name: 'Test model',
    size: '42',
    unitPrice: { amount: 100, currency: 'BAM' },
    qty: 3,
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<OrdersApiService>('OrdersApiService', ['checkCartAvailability']);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CartAvailabilityService,
        { provide: OrdersApiService, useValue: api },
      ],
    });
    service = TestBed.inject(CartAvailabilityService);
  });

  it('maps insufficient stock to the Serbian cart message without changing quantity', () => {
    api.checkCartAvailability.and.returnValue(
      of({
        valid: false,
        items: [
          {
            sizeVariantAttributeId: 'size-attribute-id',
            variantId: 'variant-id',
            requestedQuantity: 3,
            availableQuantity: 1,
            available: false,
            reason: 'INSUFFICIENT_QUANTITY',
          },
        ],
      }),
    );

    service.validateNow([item]).subscribe();

    expect(api.checkCartAvailability).toHaveBeenCalledOnceWith({
      items: [{ sizeVariantAttributeId: 'size-attribute-id', quantity: 3 }],
    });
    expect(service.valid()).toBeFalse();
    expect(service.messageFor(item)).toBe('Dostupna količina je sada 1.');
    expect(item.qty).toBe(3);
  });

  it('keeps validation errors distinct from an empty or unavailable result', () => {
    api.checkCartAvailability.and.returnValue(throwError(() => new Error('network')));

    service.validateNow([item]).subscribe({ error: () => undefined });

    expect(service.valid()).toBeNull();
    expect(service.results()).toEqual({});
    expect(service.error()).toContain('nije moguće provjeriti');
  });
});
