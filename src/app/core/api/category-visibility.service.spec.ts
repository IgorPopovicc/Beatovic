import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defer, of, throwError } from 'rxjs';

import { CatalogApiService } from './catalog-api.sevice';
import { CategoryVisibilityService } from './category-visibility.service';
import { ProductsApiService } from './products-api.service';

describe('CategoryVisibilityService', () => {
  let service: CategoryVisibilityService;
  let catalogApi: jasmine.SpyObj<CatalogApiService>;
  let productsApi: jasmine.SpyObj<ProductsApiService>;

  beforeEach(() => {
    catalogApi = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', [
      'getCategoryChildren',
    ]);
    productsApi = jasmine.createSpyObj<ProductsApiService>('ProductsApiService', ['search']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CategoryVisibilityService,
        { provide: CatalogApiService, useValue: catalogApi },
        { provide: ProductsApiService, useValue: productsApi },
      ],
    });

    service = TestBed.inject(CategoryVisibilityService);
  });

  it('intersects raw children with positive contextual facet IDs and keeps raw labels/codes', () => {
    const visible = service.deriveVisibleChildren(
      'category-runtime-id',
      [
        { id: 'shirts-id', value: 'MAJICE', displayValue: 'Majice' },
        { id: 'bras-id', value: 'BRUSEVI', displayValue: 'Grudnjaci' },
        { id: 'dresses-id', value: 'HALJINE', displayValue: 'Haljine' },
      ],
      [
        {
          id: 'category-runtime-id',
          name: 'KATEGORIJA',
          values: [
            {
              id: 'shirts-id',
              value: 'Majice from facet',
              count: 9,
              alreadySelected: false,
            },
            { id: 'bras-id', value: 'Grudnjaci from facet', count: 0, alreadySelected: false },
          ],
        },
      ],
    );

    expect(visible).toEqual([
      {
        id: 'shirts-id',
        value: 'MAJICE',
        displayValue: 'Majice',
        count: 9,
        alreadySelected: false,
      },
    ]);
  });

  it('uses separate contextual cache entries for the same parent under men and women', () => {
    catalogApi.getCategoryChildren.and.returnValue(
      of([
        { id: 'shirts-id', value: 'MAJICE' },
        { id: 'dresses-id', value: 'HALJINE' },
      ]),
    );
    productsApi.search.and.callFake((request) => {
      const genderId = request.initialCategoryFilters?.['gender-category-id']?.[0];
      const value =
        genderId === 'men-id'
          ? { id: 'shirts-id', value: 'MAJICE' }
          : { id: 'dresses-id', value: 'HALJINE' };
      return of({
        variants: [],
        availableAttributes: [],
        availableCategories: [
          {
            id: 'category-id',
            name: 'KATEGORIJA',
            values: [{ ...value, count: 1, alreadySelected: false }],
          },
        ],
        totalResults: 1,
      });
    });

    const menRequest = {
      categoryId: 'category-id',
      parentCategoryValueId: 'clothing-id',
      genderCategoryId: 'gender-category-id',
      genderValueId: 'men-id',
    };
    const womenRequest = { ...menRequest, genderValueId: 'women-id' };

    let menValues: string[] = [];
    let womenValues: string[] = [];
    service.getVisibleChildren(menRequest).subscribe((values) => {
      menValues = values.map((value) => value.value);
    });
    service.getVisibleChildren(menRequest).subscribe();
    service.getVisibleChildren(womenRequest).subscribe((values) => {
      womenValues = values.map((value) => value.value);
    });

    expect(menValues).toEqual(['MAJICE']);
    expect(womenValues).toEqual(['HALJINE']);
    expect(productsApi.search).toHaveBeenCalledTimes(2);
    expect(productsApi.search.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({
        initialCategoryFilters: { 'gender-category-id': ['men-id'] },
        categoryFilters: { 'category-id': ['clothing-id'] },
      }),
    );
  });

  it('evicts a failed contextual request so it can be retried', () => {
    let attempts = 0;
    catalogApi.getCategoryChildren.and.returnValue(of([{ id: 'shirts-id', value: 'MAJICE' }]));
    productsApi.search.and.returnValue(
      defer(() => {
        attempts += 1;
        return attempts === 1
          ? throwError(() => new Error('temporary'))
          : of({
              variants: [],
              availableAttributes: [],
              availableCategories: [
                {
                  id: 'category-id',
                  name: 'KATEGORIJA',
                  values: [{ id: 'shirts-id', value: 'MAJICE', count: 1, alreadySelected: false }],
                },
              ],
              totalResults: 1,
            });
      }),
    );

    const request = {
      categoryId: 'category-id',
      parentCategoryValueId: 'clothing-id',
      genderCategoryId: 'gender-category-id',
      genderValueId: 'men-id',
    };

    service.getVisibleChildren(request).subscribe({ error: () => undefined });
    service.getVisibleChildren(request).subscribe((values) => {
      expect(values.map((value) => value.value)).toEqual(['MAJICE']);
    });

    expect(attempts).toBe(2);
  });
});
