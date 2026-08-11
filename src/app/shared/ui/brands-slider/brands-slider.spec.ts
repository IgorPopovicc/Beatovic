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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: CatalogApiService,
          useValue: {
            getCategoryValuesByName: () =>
              of({ categoryId: 'brand-category', values: [{ id: 'brand-1', value: 'Nike' }] }),
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
});
