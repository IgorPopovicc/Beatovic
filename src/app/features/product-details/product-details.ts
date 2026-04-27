import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductDetailsModel } from '../../shared/data/products.mock';
import { CartStore } from '../../core/cart/cart.store';
import { ProductDetailsResolved } from './product-details.resolver';
import { currencyDisplayLabel, normalizeCurrencyCode } from '../../shared/utils/currency';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, DecimalPipe, RouterLink],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly cart = inject(CartStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private shareNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly product = signal<ProductDetailsModel | null>(null);
  readonly shareNotice = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

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

  readonly hasSizeOptions = computed(() => (this.product()?.sizes?.length ?? 0) > 0);

  readonly selectedSizeOutOfStock = computed(() => {
    const selected = this.selectedSize();
    if (!selected) return false;
    return this.sizeQty(selected) <= 0;
  });

  readonly canAddToCart = computed(() => {
    const p = this.product();
    if (!p) return false;

    const hasSizes = this.hasSizeOptions();
    const selected = this.selectedSize();

    if (hasSizes && !selected) return false;
    if (!this.inStockUi()) return false;

    if (hasSizes) {
      const sizeValue = String(selected ?? '');
      if (this.sizeQty(sizeValue) <= 0) return false;
      if (!this.sizeAttrElementIdMap()[sizeValue]) return false;
    }

    return true;
  });

  readonly sizeIsOutOfStock = (size: string | number) => {
    return this.sizeQty(size) <= 0;
  };

  constructor() {
    this.route.data
      .pipe(map((data) => (data['product'] as ProductDetailsResolved | null) ?? null))
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  ngOnDestroy(): void {
    if (this.shareNoticeTimer) {
      clearTimeout(this.shareNoticeTimer);
    }
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
    if (!this.canAddToCart()) return;

    const selected = this.selectedSize();
    const hasSizes = this.hasSizeOptions();
    if (hasSizes && !selected) return;

    const sizeValue = hasSizes ? (selected ?? '') : '';
    const sizeAttrElementId = hasSizes ? this.sizeAttrElementIdMap()[sizeValue] : '';

    if (hasSizes) {
      const qty = Number(this.sizeQtyMap()[sizeValue] ?? 0);
      // Defensive guard in case button state is bypassed manually.
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
        currency: normalizeCurrencyCode(p.currency),
      },
      qty: 1,
    });
  }

  currencyLabel(currency: unknown): string {
    return currencyDisplayLabel(currency);
  }

  async shareProduct(): Promise<void> {
    const p = this.product();
    if (!p || !isPlatformBrowser(this.platformId)) return;

    const url = window.location.href;
    const shareData: ShareData = {
      title: p.name,
      text: p.shortDescription || p.name,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        this.showShareNotice('success', 'Proizvod je spreman za dijeljenje.');
        return;
      }

      await navigator.clipboard.writeText(url);
      this.showShareNotice('success', 'Link proizvoda je kopiran.');
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;

      try {
        await navigator.clipboard.writeText(url);
        this.showShareNotice('success', 'Link proizvoda je kopiran.');
      } catch {
        this.showShareNotice('error', 'Link nije moguće kopirati. Pokušajte ponovo.');
      }
    }
  }

  private showShareNotice(kind: 'success' | 'error', text: string): void {
    if (this.shareNoticeTimer) {
      clearTimeout(this.shareNoticeTimer);
    }

    this.shareNotice.set({ kind, text });
    this.shareNoticeTimer = setTimeout(() => this.shareNotice.set(null), 3200);
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
