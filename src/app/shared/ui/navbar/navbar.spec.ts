import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Navbar } from './navbar';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';
import { of, throwError } from 'rxjs';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  let catalogApi: jasmine.SpyObj<CatalogApiService>;

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
        ? of([{ id: 'gender-runtime-id', value: 'MUSKARCI', displayValue: 'Muškarci' }])
        : of([
            {
              id: 'category-runtime-id',
              value: 'OBUCA',
              displayValue: 'OBUĆA',
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
    catalogApi.getCategoryChildren.and.returnValue(
      of([{ id: 'child-runtime-id', value: 'PATIKE_ZA_TRČANJE', displayValue: 'Patike za trčanje' }]),
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

    expect(catalogApi.getCategoryChildren).toHaveBeenCalledOnceWith('category-runtime-id');
    expect(component.activeChildren()[0].descendants).toEqual([
      { label: 'Patike za trčanje', link: '/catalog/muskarci/obuca/patike-za-trčanje' },
    ]);
  });

  it('allows a lazy child request to be retried after a temporary failure', () => {
    const genderIndex = component.menu().findIndex((item) => item.label === 'Muškarci');
    component.openSub(genderIndex);
    catalogApi.getCategoryChildren.and.returnValues(
      throwError(() => new Error('temporary')),
      of([{ id: 'child-id', value: 'PATIKE', displayValue: 'Patike' }]),
    );

    component.toggleCategoryChildren(component.activeChildren()[0]);
    expect(component.activeChildren()[0].error).toBeTrue();
    expect(component.activeChildren()[0].descendants).toBeUndefined();

    component.toggleCategoryChildren(component.activeChildren()[0]);
    expect(catalogApi.getCategoryChildren).toHaveBeenCalledTimes(2);
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

    expect(catalogApi.getCategoryChildren).toHaveBeenCalledOnceWith('toys-runtime-id');
    expect(component.activeChildren()[0].descendants).toEqual([
      {
        label: 'Patike za trčanje',
        link: '/catalog/igracke-i-ostalo/patike-za-trčanje',
      },
    ]);
  });
});
