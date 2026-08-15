import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProductCard, ProductCardComponent } from './product-card';

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
      providers: [provideHttpClient(), provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the branded missing-image state when no image is available', () => {
    expect(fixture.nativeElement.querySelector('app-product-image [role="img"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-product-image img')).toBeNull();
  });
});
