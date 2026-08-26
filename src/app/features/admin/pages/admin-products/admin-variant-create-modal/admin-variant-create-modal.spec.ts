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
      'getProduct',
      'createVariantMultipart',
    ]);
    productsApi.searchProduct.and.returnValue(of([]));
    productsApi.getProduct.and.returnValue(of({
      id: 'product-id',
      productName: 'Proizvod',
      productDescription: 'Opis',
      productSku: 'PRODUCT-SKU',
      categories: [],
      variants: [],
    }));

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

  it('loads existing variants from the selected product UUID', () => {
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

    const productDetails: Product = {
      ...product,
      variants: [
        {
          id: 'authoritative-variant-id',
          sku: 'PRODUCT-SKU-MODEL-SKU',
          displaySku: 'PRODUCT-SKU-MODEL-SKU',
          colorVariantAttributeValue: 'Crna',
        },
      ],
    };
    productsApi.getProduct.and.returnValue(of(productDetails));

    component.selectProduct(product);

    expect(productsApi.getProduct).toHaveBeenCalledOnceWith('product-id');
    expect(component.variants()).toEqual(productDetails.variants ?? []);
    expect(component.selectedProduct()).toEqual(productDetails);
    expect(component.variantsLoaded()).toBeTrue();
    expect(component.variantsError()).toBeNull();
  });
});
