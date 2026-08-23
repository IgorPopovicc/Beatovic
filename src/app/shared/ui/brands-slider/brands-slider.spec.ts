import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandsSlider } from './brands-slider';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';
import { of } from 'rxjs';

describe('BrandsSlider', () => {
  let component: BrandsSlider;
  let fixture: ComponentFixture<BrandsSlider>;
  let getCategoryValuesByName: jasmine.Spy;

  beforeEach(async () => {
    getCategoryValuesByName = jasmine.createSpy().and.returnValue(
      of({
        categoryId: 'brand-category',
        values: [
          { id: 'brand-1', value: 'Nike' },
          { id: 'brand-2', value: 'Adidas' },
          { id: 'brand-3', value: 'Puma' },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: CatalogApiService,
          useValue: {
            getCategoryValuesByName,
          },
        },
      ],
      imports: [BrandsSlider],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandsSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the API order once in static grid mode with existing brand navigation', () => {
    fixture.componentRef.setInput('layout', 'grid');
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const links = Array.from(page.querySelectorAll<HTMLAnchorElement>('.logos__grid .brand-link'));

    expect(getCategoryValuesByName).toHaveBeenCalledOnceWith('BREND');
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Nike', 'Adidas', 'Puma']);
    links.forEach((link, index) => {
      const destination = new URL(link.href);
      expect(destination.pathname).toBe('/catalog/muskarci/obuca');
      expect(destination.searchParams.get('q')).toBe(['Nike', 'Adidas', 'Puma'][index]);
    });
    expect(page.querySelector('.logos__marquee')).toBeNull();
  });
});
