import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ProductDetails } from './product-details';
import { productDetailsResolver } from './product-details.resolver';

describe('Product details direct navigation stock gate', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
    provideRouter([{ path: 'product/:id', component: ProductDetails,
      resolve: { product: productDetailsResolver } }]),
  ] }));

  for (const quantity of [0, 2]) {
    it(`renders the correct purchase state for stock ${quantity}`, async () => {
      const harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl('/product/variant-id', ProductDetails);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/products/variants/variant-id/details').flush({
        id: 'variant-id', productName: 'Test proizvod', finalPrice: 100,
        attributes: [{ id: 'size-id', attributeId: 'size', attributeName: 'VELICINA',
          attributeValueId: 'medium', value: 'M', quantity }],
        relatedProducts: [], images: [],
      });
      const component = await navigation;
      harness.detectChanges();
      expect(component.notFound()).toBe(quantity === 0);
      if (quantity === 0) {
        expect(harness.routeNativeElement?.textContent).toContain('Proizvod nije dostupan');
        expect(component.canAddToCart()).toBeFalse();
      } else {
        component.selectSize('M');
        expect(component.canAddToCart()).toBeTrue();
      }
      http.verify();
    });
  }
});
