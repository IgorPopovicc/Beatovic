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

  function loadGallery(count: number): HTMLElement {
    component.product.set({
      id: 'gallery-test',
      name: 'Gallery test',
      slug: 'gallery-test',
      price: 100,
      brand: 'Planeta',
      gallery: Array.from({ length: count }, (_, index) => ({
        desktop: `assets/images/products/no-image.svg?image=${index}`,
        mobile: `assets/images/products/no-image.svg?image=${index}`,
        alt: `Slika ${index + 1}`,
        w: 800,
        h: 800,
      })),
    });
    component.notFound.set(false);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  for (const count of [0, 1]) {
    it(`keeps ${count} images safe and hides redundant arrows`, () => {
      const root = loadGallery(count);
      component.prev();
      component.next();
      component.onKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(component.activeIndex()).toBe(0);
      expect(root.querySelector('.gallery .nav')).toBeNull();
      if (count === 0) expect(component.activeImage()).toBeNull();
      else expect(component.activeImage()).toBe(component.gallery()[0]);
    });
  }

  for (const count of [2, 3]) {
    it(`wraps ${count} images in both directions and keeps thumbnail selection correct`, () => {
      const root = loadGallery(count);
      root.querySelector<HTMLButtonElement>('.gallery .prev')!.click();
      fixture.detectChanges();
      expect(component.activeIndex()).toBe(count - 1);
      expect(root.querySelector('.thumb.active')?.getAttribute('aria-label')).toBe(
        `Izaberite sliku ${count}`,
      );
      root.querySelector<HTMLButtonElement>('.gallery .next')!.click();
      expect(component.activeIndex()).toBe(0);

      root.querySelectorAll<HTMLButtonElement>('.thumb')[count - 1].click();
      expect(component.activeIndex()).toBe(count - 1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(component.activeIndex()).toBe(0);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(component.activeIndex()).toBe(count - 1);
    });
  }

  it('wraps horizontal swipes while ignoring vertical gestures', () => {
    loadGallery(3);
    const swipe = (startX: number, endX: number, endY = 0) => {
      component.onTouchStart({
        touches: [{ clientX: startX, clientY: 0 }],
      } as unknown as TouchEvent);
      component.onTouchEnd({
        changedTouches: [{ clientX: endX, clientY: endY }],
      } as unknown as TouchEvent);
    };
    swipe(50, 150);
    expect(component.activeIndex()).toBe(2);
    swipe(150, 50);
    expect(component.activeIndex()).toBe(0);
    swipe(150, 50, 200);
    expect(component.activeIndex()).toBe(0);
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
