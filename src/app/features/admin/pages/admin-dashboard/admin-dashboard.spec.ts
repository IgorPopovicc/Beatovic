import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminDashboard } from './admin-dashboard';
import { AdminOrdersApi } from '../../../../core/admin-api/admin-prders-api';
import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';
import { AdminDiscountsApi } from '../../../../core/admin-api/admin-discount-api';
import { AdminCouponsApi } from '../../../../core/admin-api/admin-coupons-api';
import { AdminNewsletterApi } from '../../../../core/admin-api/admin-newsletter-api';
import { AdminContactsApi } from '../../../../core/admin-api/admin-contacts-api';

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;

  beforeEach(async () => {
    const ordersApi = jasmine.createSpyObj<AdminOrdersApi>('AdminOrdersApi', ['getByDate']);
    ordersApi.getByDate.and.returnValue(of([]));

    const productsApi = jasmine.createSpyObj<AdminProductsApi>('AdminProductsApi', [
      'getProductIdSkuPairs',
      'getVariantIdSkuPairs',
    ]);
    productsApi.getProductIdSkuPairs.and.returnValue(of([]));
    productsApi.getVariantIdSkuPairs.and.returnValue(of([]));

    const discountsApi = jasmine.createSpyObj<AdminDiscountsApi>('AdminDiscountsApi', ['getAll']);
    discountsApi.getAll.and.returnValue(of([]));

    const couponsApi = jasmine.createSpyObj<AdminCouponsApi>('AdminCouponsApi', ['getActiveCoupons']);
    couponsApi.getActiveCoupons.and.returnValue(of([]));

    const newsletterApi = jasmine.createSpyObj<AdminNewsletterApi>('AdminNewsletterApi', [
      'getActiveSubscriptions',
    ]);
    newsletterApi.getActiveSubscriptions.and.returnValue(
      of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: 1000,
        numberOfElements: 0,
        first: true,
        last: true,
        empty: true,
      }),
    );

    const contactsApi = jasmine.createSpyObj<AdminContactsApi>('AdminContactsApi', ['searchContacts']);
    contactsApi.searchContacts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection(),
        { provide: AdminOrdersApi, useValue: ordersApi },
        { provide: AdminProductsApi, useValue: productsApi },
        { provide: AdminDiscountsApi, useValue: discountsApi },
        { provide: AdminCouponsApi, useValue: couponsApi },
        { provide: AdminNewsletterApi, useValue: newsletterApi },
        { provide: AdminContactsApi, useValue: contactsApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
