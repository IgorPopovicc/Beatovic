import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HomePage } from './home-page';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductSearchResponse } from '../../../core/api/catalog.models';
import { NewsletterApiService } from '../../../core/api/newsletter-api.service';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';

const EMPTY_SEARCH_RESPONSE: ProductSearchResponse = {
  variants: [],
  availableCategories: [],
  availableAttributes: [],
  totalResults: 0,
};

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection(),
        {
          provide: ProductsApiService,
          useValue: {
            search: () => of(EMPTY_SEARCH_RESPONSE),
          },
        },
        {
          provide: NewsletterApiService,
          useValue: {
            subscribe: () => of('OK'),
          },
        },
        {
          provide: CatalogApiService,
          useValue: {
            getCategoryValuesByName: () =>
              of({ categoryId: 'brand-category', values: [{ id: 'brand-1', value: 'Nike' }] }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
