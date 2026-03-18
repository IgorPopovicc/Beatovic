import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { ProductDetailsModel } from '../../shared/data/products.mock';
import { CartStore } from '../../core/cart/cart.store';
import { ProductDetailsResolved } from './product-details.resolver';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, DecimalPipe, RouterLink],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly cart = inject(CartStore);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly product = signal<ProductDetailsModel | null>(null);

  readonly activeIndex = signal(0);
  readonly selectedSize = signal<string | null>(null);

  // sizeValue -> qty (from dto.attributes where attributeName == VELICINA)
  private readonly sizeQtyMap = signal<Record<string, number>>({});
  // sizeValue -> attributeElementId expected by order API payload
  private readonly sizeAttrElementIdMap = signal<Record<string, string>>({});

  readonly inStockUi = computed(() => {
    const p = this.product();
    if (!p) return false;

    const sizes = (p.sizes ?? []).map((x) => String(x));
    const mapQty = this.sizeQtyMap();

    if (sizes.length) {
      const selected = this.selectedSize();
      if (selected) return (mapQty[selected] ?? 0) > 0;
      return Object.values(mapQty).some((qty) => qty > 0);
    }

    return p.inStock !== false;
  });

  readonly hasDiscount = computed(() => {
    const p = this.product();
    if (!p?.oldPrice) return false;
    return p.oldPrice > p.price;
  });

  readonly percentOff = computed(() => {
    const p = this.product();
    if (!p?.oldPrice || p.oldPrice <= p.price) return null;
    const pct = Math.round((1 - p.price / p.oldPrice) * 100);
    return `${pct}%`;
  });

  readonly gallery = computed(() => this.product()?.gallery ?? []);

  readonly activeImage = computed(() => {
    const g = this.gallery();
    const i = this.activeIndex();
    return g[i] ?? null;
  });

  readonly sizeQty = (size: string | number) => {
    const key = String(size);
    return Number(this.sizeQtyMap()[key] ?? 0);
  };

  constructor() {
    this.route.data
      .pipe(map((data) => (data['product'] as ProductDetailsResolved | null) ?? null))
      .subscribe((resolved) => this.applyResolvedProduct(resolved));

    effect(() => {
      const p = this.product();
      if (!p) return;
      const sizes = (p.sizes ?? []).map((x) => String(x));
      const selected = this.selectedSize();
      if (selected && !sizes.includes(selected)) {
        this.selectedSize.set(null);
      }
    });
  }

  private applyResolvedProduct(resolved: ProductDetailsResolved | null): void {
    this.loading.set(false);
    this.activeIndex.set(0);
    this.selectedSize.set(null);
    this.sizeQtyMap.set({});
    this.sizeAttrElementIdMap.set({});

    if (!resolved) {
      this.product.set(null);
      this.notFound.set(true);
      return;
    }

    this.notFound.set(false);
    this.sizeQtyMap.set({ ...resolved.sizeQtyMap });
    this.sizeAttrElementIdMap.set({ ...resolved.sizeAttrElementIdMap });

    this.product.set({
      id: resolved.id,
      slug: resolved.slug,
      name: resolved.name,
      subtitle: resolved.subtitle,
      sku: resolved.sku,
      price: resolved.price,
      oldPrice: resolved.oldPrice,
      currency: resolved.currency,
      brand: resolved.brand,
      inStock: resolved.inStock,
      sizes: resolved.sizes,
      shortDescription: resolved.shortDescription,
      gallery: resolved.gallery,
      gender: resolved.gender,
      category: resolved.category,
    });
  }

  setActive(index: number): void {
    const g = this.gallery();
    if (!g.length) return;
    const clamped = Math.max(0, Math.min(index, g.length - 1));
    this.activeIndex.set(clamped);
  }

  prev(): void {
    this.setActive(this.activeIndex() - 1);
  }

  next(): void {
    this.setActive(this.activeIndex() + 1);
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
  }

  addToCart(): void {
    const p = this.product();
    if (!p) return;

    const selected = this.selectedSize();
    const hasSizes = (p.sizes?.length ?? 0) > 0;
    if (hasSizes && !selected) return;
    if (!this.inStockUi()) return;

    const sizeValue = hasSizes ? String(selected) : '';
    const sizeAttrElementId = hasSizes ? this.sizeAttrElementIdMap()[sizeValue] : '';

    if (hasSizes) {
      const qty = Number(this.sizeQtyMap()[sizeValue] ?? 0);
      if (qty <= 0) return;
      if (!sizeAttrElementId) return;
    }

    const image = p.gallery?.[0]?.mobile || p.gallery?.[0]?.desktop || '';
    const lineId = hasSizes ? `${sizeAttrElementId}::${sizeValue}` : p.id;

    this.cart.add({
      id: lineId,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      size: hasSizes ? sizeValue : null,
      image: image ? { url: image, alt: p.name } : null,
      unitPrice: {
        amount: Number(p.price ?? 0),
        currency: p.currency || 'RSD',
      },
      qty: 1,
    });
  }

  private touchStartX = 0;
  private touchStartY = 0;
  private isSwiping = false;

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.isSwiping = true;
  }

  onTouchMove(_: TouchEvent): void {
    if (!this.isSwiping) return;
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.isSwiping) return;
    this.isSwiping = false;

    const dx = event.changedTouches[0].clientX - this.touchStartX;
    const dy = event.changedTouches[0].clientY - this.touchStartY;

    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) this.next();
    else this.prev();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.prev();
    if (event.key === 'ArrowRight') this.next();
  }
}
