import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NewCollection } from './new-collection';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductSearchResponse } from '../../../core/api/catalog.models';

const EMPTY_SEARCH_RESPONSE: ProductSearchResponse = {
  variants: [],
  availableCategories: [],
  availableAttributes: [],
  totalResults: 0,
};

describe('NewCollection', () => {
  let component: NewCollection;
  let fixture: ComponentFixture<NewCollection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCollection],
      providers: [
        {
          provide: ProductsApiService,
          useValue: {
            search: () => of(EMPTY_SEARCH_RESPONSE),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewCollection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
