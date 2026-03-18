import { Component, Input } from '@angular/core';
import { DecimalPipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface ProductImage {
  desktop: string;
  mobile: string;
  w: number;
  h: number;
  alt: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  price: number;
  oldPrice?: number | null;
  currency?: string;
  discountLabel?: string;
  image: ProductImage;
  priority?: boolean;
}

export type ProductCardVariant = 'default' | 'compact' | 'home';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, DecimalPipe],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductCard;
  @Input() variant: ProductCardVariant = 'default';
  private imageFallback = false;

  get imageDesktop(): string {
    return this.imageFallback ? 'assets/images/products/test.webp' : this.product.image.desktop;
  }

  get hasDiscount() {
    const p = this.product;
    return !!(p.oldPrice && p.oldPrice > p.price);
  }

  get percentOff(): string | null {
    const p = this.product;
    if (!this.hasDiscount) return null;
    const pct = Math.round((1 - p.price / (p.oldPrice as number)) * 100);
    return `${pct}%`;
  }

  get imageSizes(): string {
    if (this.variant === 'home') {
      return '(max-width: 680px) 84vw, (max-width: 1100px) 34vw, 18vw';
    }

    if (this.variant === 'compact') {
      return '(max-width: 680px) 86vw, (max-width: 1100px) 40vw, 20vw';
    }

    return '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw';
  }

  onImageError(): void {
    this.imageFallback = true;
  }
}
