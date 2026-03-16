import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HomePage } from './home-page';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductSearchResponse } from '../../../core/api/catalog.models';

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
      providers: [
        {
          provide: ProductsApiService,
          useValue: {
            search: () => of(EMPTY_SEARCH_RESPONSE),
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
