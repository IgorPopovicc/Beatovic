import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductImageComponent } from './product-image';

describe('ProductImageComponent', () => {
  let fixture: ComponentFixture<ProductImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductImageComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductImageComponent);
  });

  it('renders the local visual state without requesting a known backend placeholder', () => {
    fixture.componentRef.setInput('src', '/media/product/no-image-web.jpg');
    fixture.componentRef.setInput('alt', 'Test proizvod');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'Test proizvod',
    );
  });

  it('switches once from a broken real URL to the visual fallback', () => {
    fixture.componentRef.setInput('src', 'https://cdn.example.com/broken.webp');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image).not.toBeNull();
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="img"]')).not.toBeNull();
  });
});
