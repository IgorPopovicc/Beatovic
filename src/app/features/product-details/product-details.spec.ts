import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetails } from './product-details';

describe('ProductDetails', () => {
  let component: ProductDetails;
  let fixture: ComponentFixture<ProductDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [ProductDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a safe collapsible product description only when present', () => {
    component.product.set({
      id: 'variant-id',
      slug: 'model',
      name: 'Model',
      price: 100,
      brand: 'Planeta',
      productDescription: '<b>Prvi red</b>\nDrugi red',
      gallery: [],
    });
    component.notFound.set(false);
    component.loading.set(false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.product-info-toggle');
    expect(toggle?.textContent).toContain('Detalji proizvoda');
    expect(root.querySelector('.product-info-content')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.product-info-content b')).toBeNull();
    expect(root.querySelector('.product-info-content')?.textContent).toContain('<b>Prvi red</b>');

    toggle?.click();
    fixture.detectChanges();
    expect(root.querySelector('.product-info-content')?.getAttribute('aria-hidden')).toBe('false');
  });
});
