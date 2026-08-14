import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminCouponsApi } from '../admin-api/admin-coupons-api';
import { AdminProductsApi } from '../admin-api/admin-products-api';
import { AuthService } from '../auth/auth.service';
import { CatalogApiService } from './catalog-api.sevice';
import { CouponsApiService } from './coupons-api.service';
import { AdminNewsletterApi } from '../admin-api/admin-newsletter-api';

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

  it('uses the current active-coupon endpoint for admin and checkout clients', () => {
    TestBed.inject(AdminCouponsApi).getActiveCoupons().subscribe();
    const adminRequest = http.expectOne('/api/coupons/admin/active');
    expect(adminRequest.request.method).toBe('GET');
    adminRequest.flush([]);

    TestBed.inject(CouponsApiService).lookupCouponByCode('SAVE10').subscribe();
    const checkoutRequest = http.expectOne('/api/coupons/admin/active');
    expect(checkoutRequest.request.method).toBe('GET');
    checkoutRequest.flush([]);
  });

  it('uses the current coupon deactivation endpoint', () => {
    TestBed.inject(AdminCouponsApi).deactivateCoupon('coupon-id').subscribe();

    const request = http.expectOne('/api/coupons/admin/coupon-id');
    expect(request.request.method).toBe('DELETE');
    request.flush('', { status: 204, statusText: 'No Content' });
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
});
