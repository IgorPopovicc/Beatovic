import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Navbar } from './navbar';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';
import { CategoryVisibilityService } from '../../../core/api/category-visibility.service';
import { of, throwError } from 'rxjs';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  let catalogApi: jasmine.SpyObj<CatalogApiService>;
  let categoryVisibility: jasmine.SpyObj<CategoryVisibilityService>;

  beforeEach(async () => {
    catalogApi = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', [
      'getCategoryIdByName',
      'getCategoryValues',
      'getCategoryChildren',
    ]);
    catalogApi.getCategoryIdByName.and.callFake((name) =>
      of(name === 'POL' ? 'pol-id' : name === 'KATEGORIJA' ? 'category-id' : null),
    );
    catalogApi.getCategoryValues.and.callFake((id) =>
      id === 'pol-id'
        ? of([
            { id: 'men-runtime-id', value: 'MUSKARCI', displayValue: 'Muškarci' },
            { id: 'women-runtime-id', value: 'ZENE', displayValue: 'Žene' },
          ])
        : of([
            {
              id: 'category-runtime-id',
              value: 'OBUCA',
              displayValue: 'OBUĆA',
              hasChildren: true,
            },
            {
              id: 'clothing-runtime-id',
              value: 'ODECA',
              displayValue: 'ODJEĆA',
              hasChildren: true,
            },
            {
              id: 'toys-runtime-id',
              value: 'IGRACKE_I_OSTALO',
              displayValue: 'Igračke',
              hasChildren: true,
            },
          ]),
    );
    categoryVisibility = jasmine.createSpyObj<CategoryVisibilityService>(
      'CategoryVisibilityService',
      ['getVisibleChildren'],
    );
    categoryVisibility.getVisibleChildren.and.returnValue(
      of([
        {
          id: 'child-runtime-id',
          value: 'PATIKE_ZA_TRČANJE',
          displayValue: 'Patike za trčanje',
          count: 4,
          alreadySelected: false,
        },
      ]),
    );

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: CatalogApiService,
          useValue: catalogApi,
        },
        {
          provide: CategoryVisibilityService,
          useValue: categoryVisibility,
        },
      ],
      imports: [Navbar],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses stable category values in clean URLs and lazy-loads runtime child IDs', () => {
    const genderIndex = component.menu().findIndex((item) => item.label === 'Muškarci');
    component.openSub(genderIndex);
    const category = component.activeChildren()[0];

    expect(category.label).toBe('OBUĆA');
    expect(category.link).toBe('/catalog/muskarci/obuca');
    expect(category.link).not.toContain('runtime-id');

    component.toggleCategoryChildren(category);

    expect(categoryVisibility.getVisibleChildren).toHaveBeenCalledOnceWith({
      categoryId: 'category-id',
      parentCategoryValueId: 'category-runtime-id',
      genderCategoryId: 'pol-id',
      genderValueId: 'men-runtime-id',
    });
    expect(component.activeChildren()[0].descendants).toEqual([
      { label: 'Patike za trčanje', link: '/catalog/muskarci/obuca/patike-za-trčanje' },
    ]);
  });

  it('allows a lazy child request to be retried after a temporary failure', () => {
    const genderIndex = component.menu().findIndex((item) => item.label === 'Muškarci');
    component.openSub(genderIndex);
    categoryVisibility.getVisibleChildren.and.returnValues(
      throwError(() => new Error('temporary')),
      of([
        {
          id: 'child-id',
          value: 'PATIKE',
          displayValue: 'Patike',
          count: 2,
          alreadySelected: false,
        },
      ]),
    );

    component.toggleCategoryChildren(component.activeChildren()[0]);
    expect(component.activeChildren()[0].error).toBeTrue();
    expect(component.activeChildren()[0].descendants).toBeUndefined();

    component.toggleCategoryChildren(component.activeChildren()[0]);
    expect(categoryVisibility.getVisibleChildren).toHaveBeenCalledTimes(2);
    expect(component.activeChildren()[0].descendants).toEqual([
      { label: 'Patike', link: '/catalog/muskarci/obuca/patike' },
    ]);
  });

  it('exposes standalone category descendants through clean lazy-loaded URLs', () => {
    const toysIndex = component.menu().findIndex((item) => item.label === 'Igračke');
    component.openSub(toysIndex);
    const toysRoot = component.activeChildren()[0];

    expect(toysRoot.link).toBe('/catalog/igracke-i-ostalo');
    component.toggleCategoryChildren(toysRoot);

    expect(categoryVisibility.getVisibleChildren).toHaveBeenCalledOnceWith({
      categoryId: 'category-id',
      parentCategoryValueId: 'toys-runtime-id',
      genderCategoryId: undefined,
      genderValueId: undefined,
    });
    expect(component.activeChildren()[0].descendants).toEqual([
      {
        label: 'Patike za trčanje',
        link: '/catalog/igracke-i-ostalo/patike-za-trčanje',
      },
    ]);
  });

  it('keeps visibility isolated when the same raw parent is opened under different genders', () => {
    categoryVisibility.getVisibleChildren.and.callFake((request) =>
      request.genderValueId === 'men-runtime-id'
        ? of([
            {
              id: 'shirts-id',
              value: 'MAJICE',
              displayValue: 'Majice',
              count: 12,
              alreadySelected: false,
            },
          ])
        : of([
            {
              id: 'dresses-id',
              value: 'HALJINE',
              displayValue: 'Haljine',
              count: 8,
              alreadySelected: false,
            },
          ]),
    );

    const menIndex = component.menu().findIndex((item) => item.label === 'Muškarci');
    component.openSub(menIndex);
    const menClothing = component.activeChildren().find((child) => child.value === 'ODECA');
    expect(menClothing).toBeDefined();
    component.toggleCategoryChildren(menClothing!);

    const womenIndex = component.menu().findIndex((item) => item.label === 'Žene');
    component.openSub(womenIndex);
    const womenClothing = component.activeChildren().find((child) => child.value === 'ODECA');
    expect(womenClothing).toBeDefined();
    component.toggleCategoryChildren(womenClothing!);

    expect(
      component.activeChildren().find((child) => child.value === 'ODECA')?.descendants,
    ).toEqual([{ label: 'Haljine', link: '/catalog/zene/odeca/haljine' }]);

    component.openSub(menIndex);
    expect(
      component.activeChildren().find((child) => child.value === 'ODECA')?.descendants,
    ).toEqual([{ label: 'Majice', link: '/catalog/muskarci/odeca/majice' }]);
  });

  it('uses safe public links when the category API is unavailable', () => {
    catalogApi.getCategoryIdByName.and.returnValue(
      throwError(() => new Error('catalog unavailable')),
    );

    (component as unknown as { loadDynamicMenu(): void }).loadDynamicMenu();

    expect(component.menu()).toEqual([
      { label: 'Početna', link: '/' },
      { label: 'Brendovi', link: '/brands' },
    ]);
  });
});
