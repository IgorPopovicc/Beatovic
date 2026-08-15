import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { currencyDisplayLabel } from '../../utils/currency';
import { ProductImageComponent } from '../product-image/product-image';

export interface ProductImage {
  desktop: string;
  mobile: string;
  thumbnail?: string;
  original?: string;
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
  imports: [RouterLink, DecimalPipe, ProductImageComponent],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductCard;
  @Input() variant: ProductCardVariant = 'default';

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

  get currencyLabel(): string {
    return currencyDisplayLabel(this.product.currency);
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
}
