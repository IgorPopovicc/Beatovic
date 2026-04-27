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
      desktop: 'assets/images/products/test.webp',
      mobile: 'assets/images/products/test.webp',
      w: 1200,
      h: 1200,
      alt: 'Test proizvod',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
