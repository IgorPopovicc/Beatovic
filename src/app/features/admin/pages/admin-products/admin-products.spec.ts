import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminProducts } from './admin-products';
import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';

describe('AdminProducts', () => {
  let component: AdminProducts;
  let fixture: ComponentFixture<AdminProducts>;
  let api: jasmine.SpyObj<AdminProductsApi>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminProductsApi>('AdminProductsApi', [
      'searchMain',
      'searchProduct',
      'deleteVariant',
      'deleteProduct',
    ]);
    api.searchMain.and.returnValue(
      of({ foundVariants: [], foundCategories: [], foundAttributes: [], totalResults: 0 }),
    );
    api.searchProduct.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideZonelessChangeDetection(),
        { provide: AdminProductsApi, useValue: api },
      ],
      imports: [AdminProducts],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProducts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders and uses the real variant UUID instead of the parent product UUID', async () => {
    api.searchMain.and.returnValue(
      of({
        foundVariants: [
          {
            id: 'variant-uuid',
            productId: 'product-uuid',
            productName: 'Uno model',
            sku: 'UNO-001',
            finalPrice: 99,
          },
        ],
        foundCategories: [],
        foundAttributes: [],
        totalResults: 1,
      }),
    );

    component.search.setValue('uno');
    await new Promise((resolve) => setTimeout(resolve, 400));
    fixture.detectChanges();

    const idElement = fixture.nativeElement.querySelector('.main .id') as HTMLElement;
    expect(idElement.textContent).toContain('variant-uuid');
    expect(idElement.textContent).not.toContain('product-uuid');

    component.editVariant(component.variants()[0]);
    expect(component.updateVariantId()).toBe('variant-uuid');
    component.closeUpdate();

    component.deleteVariant(component.variants()[0]);
    expect(component.deleteState()?.id).toBe('variant-uuid');
  });
});
