import { registerLocaleData } from '@angular/common';
import localeBs from '@angular/common/locales/bs';
import { provideHttpClient } from '@angular/common/http';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProductCard, ProductCardComponent } from './product-card';
import { mapVariantToProductCard } from './product-card.mapper';

registerLocaleData(localeBs);

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;

  const product: ProductCard = {
    id: 'test-product',
    slug: 'test-product',
    name: 'Test proizvod',
    price: 49.99,
    currency: 'BAM',
    image: {
      desktop: '',
      mobile: '',
      w: 1200,
      h: 1200,
      alt: 'Test proizvod',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideHttpClient(), provideZonelessChangeDetection(), provideRouter([]),
        { provide: LOCALE_ID, useValue: 'bs' }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  for (const [amount, displayed] of [[19.20, '19,20'], [19.99, '19,99'], [19.01, '19,01'], [20, '20,00']] as const) {
    it(`preserves API price ${amount} and renders two decimals, including the original price`, () => {
      const mapped = mapVariantToProductCard({
        id: 'test-product', productName: 'Test proizvod', finalPrice: amount, originalPrice: 29.99,
      });
      fixture.componentRef.setInput('product', mapped);
      fixture.detectChanges();

      expect(component.product.price).toBe(amount);
      expect(fixture.nativeElement.querySelector('.price').textContent.trim()).toBe(`${displayed} KM`);
      expect(fixture.nativeElement.querySelector('.old-price').textContent.trim()).toBe('29,99 KM');
    });
  }

  it('uses the branded missing-image state when no image is available', () => {
    expect(fixture.nativeElement.querySelector('app-product-image [role="img"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-product-image img')).toBeNull();
  });
});
