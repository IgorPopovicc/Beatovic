import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DiscountSlider } from './discount-slider';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductSearchResponse } from '../../../core/api/catalog.models';

const EMPTY_SEARCH_RESPONSE: ProductSearchResponse = {
  variants: [],
  availableCategories: [],
  availableAttributes: [],
  totalResults: 0,
};

describe('DiscountSlider', () => {
  let component: DiscountSlider;
  let fixture: ComponentFixture<DiscountSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscountSlider],
      providers: [
        {
          provide: ProductsApiService,
          useValue: {
            search: () => of(EMPTY_SEARCH_RESPONSE),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscountSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
