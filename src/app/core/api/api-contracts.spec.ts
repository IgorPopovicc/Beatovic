import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminCouponsApi } from '../admin-api/admin-coupons-api';
import { AdminProductsApi } from '../admin-api/admin-products-api';
import { AuthService } from '../auth/auth.service';
import { CatalogApiService } from './catalog-api.sevice';
import { OrdersApiService } from './orders-api.service';
import { AdminNewsletterApi } from '../admin-api/admin-newsletter-api';
import { AdminOrdersApi } from '../admin-api/admin-prders-api';
import { AdminOrder } from '../admin-api/admin-orders.models';

function adminOrderResponse(): AdminOrder {
  return {
    orderId: 'order-id',
    orderNumber: 'ORD-2026-000123',
    pantheonOrderId: null,
    status: 'EMAIL_VERIFIED',
    totalPrice: 100,
    description: 'Testna narudžba',
    couponCode: null,
    couponValue: null,
    couponType: null,
    userDetails: null,
    items: [],
  };
}

describe('current OpenAPI contracts', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['accessToken']);
    auth.accessToken.and.returnValue('test-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the active-coupon endpoint scoped to the admin client', () => {
    TestBed.inject(AdminCouponsApi).getActiveCoupons().subscribe();
    const adminRequest = http.expectOne('/api/coupons/admin/active');
    expect(adminRequest.request.method).toBe('GET');
    adminRequest.flush([]);
  });

  it('uses the public order quote endpoint with the exact Swagger payload', () => {
    const payload = {
      email: 'kupac@example.com',
      couponCode: 'SAVE10',
      orderItems: [{ sizeVariantAttributeId: 'size-attribute-id', quantity: 2 }],
    };

    TestBed.inject(OrdersApiService).createOrderQuote(payload).subscribe();

    const request = http.expectOne('/api/orders/quote');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({
      subtotal: 100,
      discountAmount: 10,
      totalPrice: 90,
      couponCode: 'SAVE10',
      couponType: 'PERCENTAGE',
      couponValue: 10,
    });
  });

  it('uses the current coupon deactivation endpoint', () => {
    TestBed.inject(AdminCouponsApi).deactivateCoupon('coupon-id').subscribe();

    const request = http.expectOne('/api/coupons/admin/coupon-id');
    expect(request.request.method).toBe('DELETE');
    request.flush('', { status: 204, statusText: 'No Content' });
  });

  it('preserves zero in the exact admin order-items update payload', () => {
    const payload = [{ sizeAttributeVariantId: 'size-attribute-id', quantity: 0 }];
    TestBed.inject(AdminOrdersApi).updateOrderItems('order-id', payload).subscribe();

    const request = http.expectOne('/api/orders/admin/order-id/update-items');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush(adminOrderResponse());
  });

  it('parses coupon removal as the updated order returned by Swagger', () => {
    let response: AdminOrder | undefined;
    TestBed.inject(AdminOrdersApi)
      .removeOrderCoupon('order-id')
      .subscribe((order) => (response = order));

    const request = http.expectOne('/api/orders/admin/order-id/coupon');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.responseType).toBe('json');
    const updatedOrder = adminOrderResponse();
    request.flush(updatedOrder);
    expect(response).toEqual(updatedOrder);
  });

  it('defaults admin product search to a page size of 10', () => {
    TestBed.inject(AdminProductsApi).searchProduct('colmar').subscribe();

    const request = http.expectOne('/api/products/search-product');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ searchQuery: 'colmar', page: 0, pageSize: 10 });
    request.flush([]);
  });

  it('loads navigation categories from the supported public root-values endpoint', () => {
    TestBed.inject(CatalogApiService)
      .getCategoryValues('category-id', { onlyRoot: true })
      .subscribe();

    const request = http.expectOne('/api/categories/category-id/values?onlyRoot=true');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('uses the exact category-children endpoint and preserves stable API values', () => {
    let firstResponse: unknown;
    let cachedResponse: unknown;
    const service = TestBed.inject(CatalogApiService);
    service.getCategoryChildren('root-id').subscribe((value) => (firstResponse = value));
    service.getCategoryChildren('root-id').subscribe((value) => (cachedResponse = value));

    const request = http.expectOne('/api/categories/values/root-id/children');
    expect(request.request.method).toBe('GET');
    request.flush([
      { id: 'child-id', value: 'OBUCA', displayValue: 'OBUĆA', hasChildren: false },
    ]);

    expect(firstResponse).toEqual([
      { id: 'child-id', value: 'OBUCA', displayValue: 'OBUĆA', parent: null, hasChildren: false },
    ]);
    expect(cachedResponse).toEqual(firstResponse);
  });

  it('passes newsletter admin search through the q query parameter', () => {
    TestBed.inject(AdminNewsletterApi)
      .getActiveSubscriptions({ page: 0, size: 20, sort: 'subscribedAt,desc', q: 'gmail' })
      .subscribe();

    const request = http.expectOne(
      '/api/newsletter/admin/subscriptions?page=0&size=20&q=gmail&sort=subscribedAt,desc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('creates an admin model with the current multipart variant and images fields', () => {
    const image = new File(['image'], 'model.webp', { type: 'image/webp' });
    TestBed.inject(AdminProductsApi)
      .createVariantMultipart(
        {
          productId: 'product-id',
          price: 100,
          attributes: [
            {
              attributeId: 'attribute-id',
              attributeName: 'VELICINA',
              attributeValueId: 'attribute-value-id',
              value: '42',
              quantity: 3,
            },
          ],
        },
        [image],
      )
      .subscribe();

    const request = http.expectOne('/api/products/admin/variants');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    const body = request.request.body as FormData;
    expect(body.get('variant')).toEqual(jasmine.any(Blob));
    expect(body.getAll('images')).toEqual([image]);
    request.flush({ id: 'variant-id' });
  });

  it('uses the exact admin bulk-priority endpoint and payload', () => {
    const payload = { items: [{ sku: 'MODEL-001', priority: 'HIGH' as const }] };
    TestBed.inject(AdminProductsApi).bulkUpdateVariantPriorities(payload).subscribe();

    const request = http.expectOne('/api/products/admin/variants/priority/bulk');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({ updatedCount: 1, notFoundCount: 0, notFoundSkus: [] });
  });
});
