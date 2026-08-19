import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';
import { ProductVariantPriority } from '../../../../shared/data/product-variant-priority';
import { AdminPriorityManager } from './admin-priority-manager';

describe('AdminPriorityManager', () => {
  let component: AdminPriorityManager;
  let fixture: ComponentFixture<AdminPriorityManager>;
  let api: jasmine.SpyObj<AdminProductsApi>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminProductsApi>('AdminProductsApi', [
      'searchVariantsForPriority',
      'bulkUpdateVariantPriorities',
    ]);
    api.searchVariantsForPriority.and.returnValue(
      of({ variants: [], availableCategories: [], availableAttributes: [], totalResults: 0 }),
    );
    api.bulkUpdateVariantPriorities.and.callFake((request) =>
      of({
        updatedCount: request.items.length,
        notFoundCount: 0,
        notFoundSkus: [],
      }),
    );

    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: AdminProductsApi, useValue: api }],
      imports: [AdminPriorityManager],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPriorityManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the recommended admin sort with the requested page size', () => {
    expect(api.searchVariantsForPriority).toHaveBeenCalledWith({
      page: 0,
      pageSize: 50,
      sortBy: 'PRIORITY',
      sortOrder: 'DESC',
    });
  });

  it('chunks selections above 500 without retrying and aggregates the result', () => {
    const selected = new Map<string, ProductVariantPriority>();
    for (let index = 0; index < 501; index++) selected.set(`SKU-${index}`, 'NONE');
    component.selectedBySku.set(selected);

    component.applyBulkPriority('HIGH');

    expect(api.bulkUpdateVariantPriorities).toHaveBeenCalledTimes(2);
    expect(api.bulkUpdateVariantPriorities.calls.argsFor(0)[0].items.length).toBe(500);
    expect(api.bulkUpdateVariantPriorities.calls.argsFor(1)[0].items.length).toBe(1);
    expect(component.notices().some((notice) => notice.message.includes('501'))).toBeTrue();
    expect(component.selectedCount()).toBe(0);
  });
});
