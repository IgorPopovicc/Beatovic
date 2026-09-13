import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ProductsApiService } from './products-api.service';
import { Variant } from './catalog.models';
import { hasProductStock } from './product-stock';

const variant = (id: string, quantity: number): Variant => ({
  id, productName: 'Proizvod', finalPrice: 100,
  attributes: [{ id: 'size-id', attributeId: 'size', attributeName: 'VELICINA',
    attributeValueId: 'medium', value: 'M', quantity }],
});

describe('ProductsApiService storefront stock', () => {
  let api: ProductsApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ProductsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  for (const criteria of [{}, { searchQuery: 'patike' }, { page: 2 },
    { hasActiveStock: false }, { hasActiveStock: null }, { isNew: true }, { hasActiveDiscount: true }]) {
    it(`enforces stock before pagination and filters returned zero-stock rows: ${JSON.stringify(criteria)}`, () => {
      api.search(criteria).subscribe((response) => {
        expect(response.variants.map((product) => product.id)).toEqual(['available']);
        expect(response.totalResults).toBe(37);
      });
      const request = http.expectOne('/api/products/search');
      expect(request.request.body.hasActiveStock).toBeTrue();
      expect(request.request.body.page).toBe('page' in criteria ? criteria.page : 0);
      request.flush({ variants: [variant('available', 1), variant('empty', 0)],
        totalResults: 37, availableCategories: [], availableAttributes: [] });
    });
  }

  it('uses size quantities, never color quantities or the legacy top-level quantity', () => {
    expect(hasProductStock(variant('positive', 1))).toBeTrue();
    expect(hasProductStock(variant('negative', -1))).toBeFalse();
    expect(hasProductStock({ ...variant('missing', 0), attributes: [], quantity: 20 })).toBeFalse();
    const color = variant('color', 3);
    color.attributes = color.attributes?.map((attribute) => ({ ...attribute, attributeName: 'BOJA' }));
    expect(hasProductStock(color)).toBeFalse();
  });

  it('returns the existing unavailable/not-found sentinel for direct URLs without stock', () => {
    api.getVariantDetails('empty').subscribe((product) => expect(product).toBeNull());
    http.expectOne('/api/products/variants/empty/details').flush(variant('empty', 0));
  });

  it('checks related IDs via details and excludes unavailable or failed recommendations', () => {
    api.getVariantDetails('main').subscribe((product) => {
      expect(product?.relatedProducts?.map((related) => related.id)).toEqual(['available']);
      expect(product?.relatedProducts?.[0].productName).toBe('Proizvod');
    });
    http.expectOne('/api/products/variants/main/details').flush({ ...variant('main', 2),
      relatedProducts: [{ id: 'available' }, { id: 'empty' }, { id: 'deleted' }, { id: 'available' }] });
    http.expectOne('/api/products/variants/available/details').flush(variant('available', 1));
    http.expectOne('/api/products/variants/empty/details').flush(variant('empty', 0));
    http.expectOne('/api/products/variants/deleted/details').flush('', { status: 404, statusText: 'Not Found' });
  });
});
