import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';

import { ProductsApiService } from '../../core/api/products-api.service';
import { CatalogApiService } from '../../core/api/catalog-api.sevice';
import { Products, visiblePageRange } from './products';

describe('visiblePageRange', () => {
  it('keeps five pages visible and shifts the window at both boundaries', () => {
    expect(visiblePageRange(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePageRange(2, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePageRange(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(visiblePageRange(9, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(visiblePageRange(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it('shows every valid page when five or fewer pages exist', () => {
    expect(visiblePageRange(1, 1)).toEqual([1]);
    expect(visiblePageRange(2, 4)).toEqual([1, 2, 3, 4]);
    expect(visiblePageRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;
  let productsApi: jasmine.SpyObj<ProductsApiService>;
  let viewportScroller: jasmine.SpyObj<ViewportScroller>;

  beforeEach(async () => {
    productsApi = jasmine.createSpyObj<ProductsApiService>('ProductsApiService', ['search']);
    productsApi.search.and.returnValue(
      of({
        variants: [],
        availableCategories: [],
        availableAttributes: [],
        totalResults: 48,
      }),
    );
    viewportScroller = jasmine.createSpyObj<ViewportScroller>('ViewportScroller', [
      'scrollToPosition',
    ]);

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: ProductsApiService,
          useValue: productsApi,
        },
        { provide: ViewportScroller, useValue: viewportScroller },
      ],
      imports: [Products],
    }).compileComponents();

    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults storefront search to recommended priority sorting', () => {
    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ sortBy: 'PRIORITY', sortOrder: 'DESC' }),
    );
  });

  it('maps all customer-facing sort choices to the backend contract', () => {
    const cases = [
      ['preporucujemo', 'PRIORITY', 'DESC'],
      ['naziv_az', 'NAME', 'ASC'],
      ['naziv_za', 'NAME', 'DESC'],
      ['cijena_rastuce', 'PRICE', 'ASC'],
      ['cijena_opadajuce', 'PRICE', 'DESC'],
    ] as const;

    for (const [key, sortBy, sortOrder] of cases) {
      component.setSort(key);
      expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
        jasmine.objectContaining({ sortBy, sortOrder }),
      );
    }
  });

  it('scrolls to absolute top only after an intentional new catalog page loads', () => {
    viewportScroller.scrollToPosition.calls.reset();

    component.goPage(2);

    expect(productsApi.search.calls.mostRecent().args[0].page).toBe(1);
    expect(viewportScroller.scrollToPosition).toHaveBeenCalledOnceWith([0, 0]);
    component.goPage(2);
    expect(viewportScroller.scrollToPosition).toHaveBeenCalledTimes(1);
  });

  it('navigates directly with numeric buttons and ignores the already active page', () => {
    const navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    productsApi.search.and.returnValue(
      of({
        variants: [],
        availableCategories: [],
        availableAttributes: [],
        totalResults: 240,
      }),
    );
    component.response.set({
      variants: [],
      availableCategories: [],
      availableAttributes: [],
      totalResults: 240,
    });

    fixture.detectChanges();
    const pageFiveButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.page-number'),
    ).find((button) => button.textContent?.trim() === '5');
    pageFiveButton?.click();

    expect(productsApi.search.calls.mostRecent().args[0].page).toBe(4);
    expect(component.visiblePages()).toEqual([3, 4, 5, 6, 7]);
    expect(navigateSpy).toHaveBeenCalledOnceWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({ page: 5 }),
        queryParamsHandling: 'merge',
      }),
    );
    const requestCount = productsApi.search.calls.count();

    fixture.detectChanges();
    const activePage = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.page-number.active',
    );
    expect(activePage?.textContent?.trim()).toBe('5');
    expect(activePage?.getAttribute('aria-current')).toBe('page');

    activePage?.click();
    expect(productsApi.search.calls.count()).toBe(requestCount);
  });

  it('disables previous and next arrows at their respective boundaries', () => {
    const root = fixture.nativeElement as HTMLElement;
    let previous = root.querySelector<HTMLButtonElement>('[aria-label="Prethodna stranica"]');
    let next = root.querySelector<HTMLButtonElement>('[aria-label="Sljedeća stranica"]');

    expect(previous?.disabled).toBeTrue();
    expect(next?.disabled).toBeFalse();

    component.goPage(2);
    fixture.detectChanges();
    previous = root.querySelector<HTMLButtonElement>('[aria-label="Prethodna stranica"]');
    next = root.querySelector<HTMLButtonElement>('[aria-label="Sljedeća stranica"]');

    expect(previous?.disabled).toBeFalse();
    expect(next?.disabled).toBeTrue();
  });

  it('renders only safe BOJA hex values and submits selected color IDs', () => {
    component.response.set({
      variants: [],
      availableCategories: [],
      availableAttributes: [
        {
          id: 'color-group',
          name: 'BOJA',
          values: [
            { id: 'black', value: '#000000', count: 4, alreadySelected: false },
            { id: 'mix', value: '#000000,#FFFFFF', count: 2, alreadySelected: false },
            { id: 'unsafe', value: 'red;url(javascript:1)', count: 1, alreadySelected: false },
          ],
        },
      ],
      totalResults: 0,
    });

    expect(component.availableColors().map((color) => color.id)).toEqual(['black', 'mix']);
    component.toggleColor('black');
    expect(productsApi.search.calls.mostRecent().args[0].attributeFilters).toEqual({
      'color-group': ['black'],
    });
  });
});

describe('Products URL state restoration', () => {
  it('restores page, search, filters, sorting, and price state from query parameters', async () => {
    const productsApi = jasmine.createSpyObj<ProductsApiService>('ProductsApiService', ['search']);
    productsApi.search.and.returnValue(
      of({ variants: [], availableCategories: [], availableAttributes: [], totalResults: 500 }),
    );
    const queryParams = new BehaviorSubject(
      convertToParamMap({
        search: 'patike',
        page: '5',
        sort: 'cijena_rastuce',
        stock: '1',
        sale: '1',
        minPrice: '50',
        maxPrice: '250',
        cf: JSON.stringify({ 'brand-group': ['brand-a'] }),
        af: JSON.stringify({ 'size-group': ['size-42'], 'color-group': ['black'] }),
      }),
    );

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: queryParams.asObservable(),
          },
        },
        { provide: ProductsApiService, useValue: productsApi },
        {
          provide: ViewportScroller,
          useValue: jasmine.createSpyObj<ViewportScroller>('ViewportScroller', [
            'scrollToPosition',
          ]),
        },
      ],
      imports: [Products],
    }).compileComponents();

    const fixture = TestBed.createComponent(Products);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        searchQuery: 'patike',
        page: 4,
        sortBy: 'PRICE',
        sortOrder: 'ASC',
        hasActiveStock: true,
        hasActiveDiscount: true,
        minPrice: 50,
        maxPrice: 250,
        categoryFilters: { 'brand-group': ['brand-a'] },
        attributeFilters: {
          'size-group': ['size-42'],
          'color-group': ['black'],
        },
      }),
    );
    expect(component.page()).toBe(5);
    expect(component.sortKey()).toBe('cijena_rastuce');

    queryParams.next(convertToParamMap({ search: 'patike', page: '3' }));

    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ searchQuery: 'patike', page: 2 }),
    );
    expect(productsApi.search.calls.count()).toBe(2);

    spyOn(TestBed.inject(Router), 'navigate').and.callFake((_, extras) => {
      const navigableParams = Object.fromEntries(
        Object.entries(extras?.queryParams ?? {}).filter(([, value]) => value !== null),
      );
      const nextParamMap = convertToParamMap(navigableParams);
      queryParams.next(nextParamMap);
      return Promise.resolve(true);
    });
    const requestCount = productsApi.search.calls.count();

    component.goPage(5);

    expect(productsApi.search.calls.mostRecent().args[0].page).toBe(4);
    expect(productsApi.search.calls.count()).toBe(requestCount + 1);
  });
});

describe('Products standalone category descendants', () => {
  it('resolves a clean parent/child URL to runtime category IDs', async () => {
    const productsApi = jasmine.createSpyObj<ProductsApiService>('ProductsApiService', ['search']);
    productsApi.search.and.returnValue(
      of({ variants: [], availableCategories: [], availableAttributes: [], totalResults: 0 }),
    );
    const catalogApi = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', [
      'getCategoryIdByName',
      'getCategoryValues',
      'getCategoryChildren',
    ]);
    catalogApi.getCategoryIdByName.and.callFake((name) =>
      of(name === 'POL' ? 'pol-id' : 'category-id'),
    );
    catalogApi.getCategoryValues.and.callFake((id) =>
      id === 'pol-id'
        ? of([{ id: 'men-id', value: 'MUSKARCI' }])
        : of([{ id: 'toys-id', value: 'IGRACKE_I_OSTALO', hasChildren: true }]),
    );
    catalogApi.getCategoryChildren.and.returnValue(
      of([{ id: 'rollers-id', value: 'ROLERI_ZA_DJECU' }]),
    );

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({
                gender: 'igracke-i-ostalo',
                category: 'roleri-za-djecu',
              }),
            ),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: ProductsApiService, useValue: productsApi },
        { provide: CatalogApiService, useValue: catalogApi },
        {
          provide: ViewportScroller,
          useValue: jasmine.createSpyObj<ViewportScroller>('ViewportScroller', [
            'scrollToPosition',
          ]),
        },
      ],
      imports: [Products],
    }).compileComponents();

    const fixture = TestBed.createComponent(Products);
    fixture.detectChanges();

    expect(catalogApi.getCategoryChildren).toHaveBeenCalledOnceWith('toys-id');
    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        initialCategoryFilters: {},
        categoryFilters: { 'category-id': ['rollers-id'] },
      }),
    );
  });
});

describe('Products gender-aware category context', () => {
  it('keeps POL and KATEGORIJA while deriving visible children and changing catalog state', async () => {
    const productsApi = jasmine.createSpyObj<ProductsApiService>('ProductsApiService', ['search']);
    productsApi.search.and.returnValue(
      of({
        variants: [],
        availableCategories: [
          {
            id: 'category-id',
            name: 'KATEGORIJA',
            values: [
              { id: 'shirts-id', value: 'Majice', count: 21, alreadySelected: false },
              { id: 'bras-id', value: 'Grudnjaci', count: 0, alreadySelected: false },
            ],
          },
          {
            id: 'brand-id',
            name: 'BREND',
            values: [{ id: 'brand-value-id', value: 'TEST', count: 4, alreadySelected: false }],
          },
        ],
        availableAttributes: [],
        totalResults: 48,
      }),
    );
    const catalogApi = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', [
      'getCategoryIdByName',
      'getCategoryValues',
      'getCategoryChildren',
    ]);
    catalogApi.getCategoryIdByName.and.callFake((name) =>
      of(name === 'POL' ? 'gender-category-id' : 'category-id'),
    );
    catalogApi.getCategoryValues.and.callFake((id) =>
      id === 'gender-category-id'
        ? of([{ id: 'men-id', value: 'MUSKARCI', displayValue: 'Muškarci' }])
        : of([
            {
              id: 'clothing-id',
              value: 'ODECA',
              displayValue: 'Odjeća',
              hasChildren: true,
            },
          ]),
    );
    catalogApi.getCategoryChildren.and.returnValue(
      of([
        { id: 'shirts-id', value: 'MAJICE', displayValue: 'Majice' },
        { id: 'bras-id', value: 'BRUSEVI', displayValue: 'Grudnjaci' },
        { id: 'dresses-id', value: 'HALJINE', displayValue: 'Haljine' },
      ]),
    );

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ gender: 'muskarci', category: 'odeca' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: ProductsApiService, useValue: productsApi },
        { provide: CatalogApiService, useValue: catalogApi },
        {
          provide: ViewportScroller,
          useValue: jasmine.createSpyObj<ViewportScroller>('ViewportScroller', [
            'scrollToPosition',
          ]),
        },
      ],
      imports: [Products],
    }).compileComponents();

    const fixture = TestBed.createComponent(Products);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        initialCategoryFilters: { 'gender-category-id': ['men-id'] },
        categoryFilters: { 'category-id': ['clothing-id'] },
      }),
    );
    expect(component.visibleCategoryChildren()).toEqual([
      {
        id: 'shirts-id',
        label: 'Majice',
        count: 21,
        selected: false,
        link: '/catalog/muskarci/odeca/majice',
      },
    ]);
    fixture.detectChanges();
    const renderedText = String(fixture.nativeElement.textContent);
    expect(renderedText).toContain('Majice');
    expect(renderedText).not.toContain('Grudnjaci');
    expect(renderedText).not.toContain('Haljine');

    component.setSort('cijena_opadajuce');
    component.toggleBrand('brand-value-id');
    component.goPage(2);

    expect(productsApi.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        initialCategoryFilters: { 'gender-category-id': ['men-id'] },
        categoryFilters: {
          'category-id': ['clothing-id'],
          'brand-id': ['brand-value-id'],
        },
        page: 1,
        sortBy: 'PRICE',
        sortOrder: 'DESC',
      }),
    );
  });
});
