import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminCouponsApi } from '../admin-api/admin-coupons-api';
import { AdminProductsApi } from '../admin-api/admin-products-api';
import { AuthService } from '../auth/auth.service';
import { CatalogApiService } from './catalog-api.sevice';
import { CouponsApiService } from './coupons-api.service';

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
});
