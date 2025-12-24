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

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, DecimalPipe],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductCard;

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
}
