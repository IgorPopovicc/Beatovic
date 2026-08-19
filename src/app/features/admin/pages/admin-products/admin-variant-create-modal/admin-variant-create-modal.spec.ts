import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminVariantCreateModal } from './admin-variant-create-modal';
import { AdminProductsApi } from '../../../../../core/admin-api/admin-products-api';
import { AdminAttributesApi } from '../../../../../core/admin-api/admin-attributes-api';
import { Product } from '../../../../../core/admin-api/admin-products.models';

describe('AdminVariantCreateModal', () => {
  let component: AdminVariantCreateModal;
  let fixture: ComponentFixture<AdminVariantCreateModal>;
  let productsApi: jasmine.SpyObj<AdminProductsApi>;

  beforeEach(async () => {
    productsApi = jasmine.createSpyObj<AdminProductsApi>('AdminProductsApi', [
      'searchProduct',
      'createVariantMultipart',
    ]);
    productsApi.searchProduct.and.returnValue(of([]));

    const attributesApi = jasmine.createSpyObj<AdminAttributesApi>('AdminAttributesApi', [
      'getAttributes',
      'getAttributeValues',
    ]);
    attributesApi.getAttributes.and.returnValue(of([]));
    attributesApi.getAttributeValues.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideZonelessChangeDetection(),
        { provide: AdminProductsApi, useValue: productsApi },
        { provide: AdminAttributesApi, useValue: attributesApi },
      ],
      imports: [AdminVariantCreateModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminVariantCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.form.controls.priority.value).toBe('NONE');
  });

  it('uses variants from the current search response without a second request', () => {
    const product: Product = {
      id: 'product-id',
      productName: 'Colmar model',
      productDescription: 'Opis',
      productSku: 'PRODUCT-SKU',
      categories: [],
      variants: [
        {
          id: 'variant-id',
          sku: 'MODEL-SKU',
          displaySku: 'MODEL SKU',
          colorVariantAttributeValue: 'Crna',
        },
      ],
    };

    component.selectProduct(product);

    expect(component.variants()).toEqual(product.variants ?? []);
    expect(component.selectedProduct()).toBe(product);
  });
});
