import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  AdminOrder,
  OrderStatus,
  isOrderEditable,
} from '../../../../core/admin-api/admin-orders.models';
import { AdminOrdersApi } from '../../../../core/admin-api/admin-prders-api';
import { AdminOrders } from './admin-orders';

function buildOrder(status: OrderStatus = 'EMAIL_VERIFIED'): AdminOrder {
  return {
    orderId: `order-${status}`,
    orderNumber: 'ORD-2026-000123',
    pantheonOrderId: null,
    status,
    totalPrice: 100,
    description: 'Testna narudžba',
    couponCode: 'SAVE10',
    couponValue: 10,
    couponType: 'PERCENTAGE',
    userDetails: {
      fullName: 'Test Kupac',
      email: 'kupac@example.com',
      address: 'Testna 1',
      phoneNumber: '123',
      municipality: 'Banja Luka',
      postalCode: '78000',
    },
    items: [
      {
        sizeAttributeVariantId: 'size-attribute-id',
        sizeVariantAttributeValue: '42',
        productName: 'Testni proizvod',
        productSku: 'SKU-1',
        quantity: 1,
        pricePerUnit: 100,
        totalItemPrice: 100,
      },
    ],
  };
}

describe('AdminOrders', () => {
  let component: AdminOrders;
  let fixture: ComponentFixture<AdminOrders>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminOrders],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOrders);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('centralizes read-only statuses while keeping active workflow statuses editable', () => {
    expect(isOrderEditable('COMPLETED')).toBeFalse();
    expect(isOrderEditable('CANCELED')).toBeFalse();
    expect(isOrderEditable('EXPIRED')).toBeFalse();
    expect(isOrderEditable('PENDING')).toBeFalse();
    expect(isOrderEditable('EMAIL_VERIFIED')).toBeTrue();
    expect(isOrderEditable('WAITING_FOR_CUSTOMER_RECONFIRMATION')).toBeTrue();
    expect(isOrderEditable('CUSTOMER_RECONFIRMED')).toBeTrue();
  });

  it('renders non-editable orders as read-only and keeps coupon information visible', () => {
    const order = buildOrder('COMPLETED');
    component.orders.set([order]);
    component.expandedOrderId.set(order.orderId);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.it-qty input')).toBeNull();
    expect(root.querySelector('.item-actions')).toBeNull();
    expect(root.querySelector('.coupon')?.textContent).toContain('SAVE10');
    expect(root.querySelector('.coupon .action-btn')).toBeNull();
    expect(root.querySelector('.read-only-note')?.textContent).toContain(
      'nije moguće mijenjati',
    );
  });

  it('allows quantity zero, preserves it in the request, and renders the backend response', () => {
    const order = buildOrder();
    const updatedOrder = { ...order, items: [], totalPrice: 0 };
    const api = TestBed.inject(AdminOrdersApi);
    const updateSpy = spyOn(api, 'updateOrderItems').and.returnValue(of(updatedOrder));
    component.orders.set([order]);

    component.onItemQuantityInput(order, 'size-attribute-id', '0');
    expect(component.editedItemQuantity(order.orderId, 'size-attribute-id', 1)).toBe(0);
    component.saveOrderItems(order);

    expect(updateSpy).toHaveBeenCalledOnceWith(order.orderId, [
      { sizeAttributeVariantId: 'size-attribute-id', quantity: 0 },
    ]);
    expect(component.orders()[0].items).toEqual([]);
    expect(component.orders()[0].totalPrice).toBe(0);
  });

  it('rejects negative quantities without sending a mutation request', () => {
    const order = buildOrder();
    const api = TestBed.inject(AdminOrdersApi);
    const updateSpy = spyOn(api, 'updateOrderItems');

    component.onItemQuantityInput(order, 'size-attribute-id', '-1');
    component.saveOrderItems(order);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(component.error()).toBe('Količina mora biti cijeli broj 0 ili veći.');
  });

  it('defensively blocks quantity and coupon actions for every read-only status', () => {
    const api = TestBed.inject(AdminOrdersApi);
    const updateSpy = spyOn(api, 'updateOrderItems');

    for (const status of ['COMPLETED', 'CANCELED', 'EXPIRED', 'PENDING'] as const) {
      const order = buildOrder(status);
      component.editedItemQuantities.set({ [`${order.orderId}:size-attribute-id`]: 0 });

      component.saveOrderItems(order);
      component.removeOrderCoupon(order);

      expect(component.confirmOpen()).withContext(status).toBeFalse();
    }

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('uses the updated order returned by coupon removal', () => {
    const order = buildOrder();
    const updatedOrder = {
      ...order,
      couponCode: null,
      couponValue: null,
      couponType: null,
      totalPrice: 110,
    };
    const api = TestBed.inject(AdminOrdersApi);
    spyOn(api, 'removeOrderCoupon').and.returnValue(of(updatedOrder));
    component.orders.set([order]);

    component.removeOrderCoupon(order);
    component.confirmMutation();

    expect(component.orders()[0]).toEqual(updatedOrder);
  });

  it('blocks a pending coupon confirmation if the loaded order became read-only', () => {
    const order = buildOrder();
    const api = TestBed.inject(AdminOrdersApi);
    const removeSpy = spyOn(api, 'removeOrderCoupon');
    component.orders.set([order]);
    component.removeOrderCoupon(order);
    component.orders.set([{ ...order, status: 'COMPLETED' }]);

    component.confirmMutation();

    expect(removeSpy).not.toHaveBeenCalled();
    expect(component.confirmOpen()).toBeFalse();
  });

  it('shows Pantheon ID directly after the order number only when present', () => {
    const completed = { ...buildOrder('COMPLETED'), pantheonOrderId: 987654 };
    component.orders.set([completed]);
    fixture.detectChanges();

    let ids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.main .id'),
    ).map((element) => element.textContent?.replace(/\s+/g, ' ').trim());
    expect(ids).toEqual([
      'Broj narudžbe: ORD-2026-000123',
      'Pantheon ID narudžbe: 987654',
    ]);

    component.orders.set([{ ...completed, pantheonOrderId: null }]);
    fixture.detectChanges();
    ids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.main .id'),
    ).map((element) => element.textContent?.replace(/\s+/g, ' ').trim());
    expect(ids).toEqual(['Broj narudžbe: ORD-2026-000123']);
  });

  it('uses zero as the minimum for editable quantity inputs', () => {
    const order = buildOrder();
    component.orders.set([order]);
    component.expandedOrderId.set(order.orderId);
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.it-qty input',
    );
    expect(input?.min).toBe('0');
  });
});
