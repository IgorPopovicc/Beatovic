import { Component, Input } from '@angular/core';
import {DecimalPipe, NgOptimizedImage} from '@angular/common';
import { RouterLink } from '@angular/router';

export interface ProductImage {
  desktop: string;   // 3:4 ili 4:5 kadar za katalog (npr. 960x1280)
  mobile: string;    // uži kadar (npr. 640x800)
  w: number;         // intrinzična širina desktop fajla
  h: number;         // intrinzična visina desktop fajla
  alt: string;
}

export interface ProductCard {
  id: string;
  slug: string;              // za rutu /product/:slug
  name: string;              // naziv proizvoda
  subtitle?: string;         // kratki opis (opciono)
  price: number;             // trenutna cijena
  oldPrice?: number | null;  // stara cijena (precrtana)
  currency?: string;         // "RSD" (default)
  discountLabel?: string;    // npr. "36%" ili "DODATNI -10%"
  image: ProductImage;
  priority?: boolean;        // ako je iznad prevoja
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

  // izračunaj % ako BE ne šalje
  get percentOff(): string | null {
    const p = this.product;
    if (!this.hasDiscount) return null;
    const pct = Math.round((1 - p.price / (p.oldPrice as number)) * 100);
    return `${pct}%`;
  }
}
