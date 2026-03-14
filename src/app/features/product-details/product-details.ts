// src/app/pages/product-details/product-details.ts
import {
  Component,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { catchError, map, of, switchMap } from 'rxjs';
import { ProductDetailsModel } from '../../shared/data/products.mock';
import { environment } from '../../../environments/environment';
import { ProductsApiService } from '../../core/api/products-api.service';
import { CartStore } from '../../core/cart/cart.store';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, DecimalPipe, RouterLink],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails {
  private route = inject(ActivatedRoute);
  private api = inject(ProductsApiService);
  private title = inject(Title);
  private meta = inject(Meta);
  private cart = inject(CartStore);

  loading = signal(true);
  notFound = signal(false);
  product = signal<ProductDetailsModel | null>(null);

  activeIndex = signal(0);
  selectedSize = signal<string | null>(null);

  // sizeValue -> qty (from dto.attributes where attributeName == VELICINA)
  private sizeQtyMap = signal<Record<string, number>>({});

  // sizeValue -> attributeElementId (THIS is what BE expects in order payload)
  private sizeAttrElementIdMap = signal<Record<string, string>>({});

  inStockUi = computed(() => {
    const p: any = this.product();
    if (!p) return false;

    const sizes: string[] = (p.sizes ?? []).map((x: any) => String(x));
    const map: Record<string, number> = this.sizeQtyMap();

    if (sizes.length) {
      const sel = this.selectedSize();
      if (sel) return (map[sel] ?? 0) > 0;
      return Object.values(map).some(q => q > 0);
    }

    return p.inStock !== false;
  });

  hasDiscount = computed(() => {
    const p = this.product();
    if (!p?.oldPrice) return false;
    return p.oldPrice > p.price;
  });

  percentOff = computed(() => {
    const p = this.product();
    if (!p?.oldPrice || p.oldPrice <= p.price) return null;
    const pct = Math.round((1 - p.price / p.oldPrice) * 100);
    return `${pct}%`;
  });

  gallery = computed(() => this.product()?.gallery ?? []);

  activeImage = computed(() => {
    const g = this.gallery();
    const i = this.activeIndex();
    return g[i] ?? null;
  });

  sizeQty = (size: string | number) => {
    const key = String(size);
    return Number(this.sizeQtyMap()[key] ?? 0);
  };

  constructor() {
    this.route.paramMap
      .pipe(
        map(pm => (pm.get('id') ?? '').trim()),
        switchMap((id) => {
          this.loading.set(true);
          this.notFound.set(false);
          this.product.set(null);
          this.activeIndex.set(0);
          this.selectedSize.set(null);
          this.sizeQtyMap.set({});
          this.sizeAttrElementIdMap.set({});

          if (!id) return of(null);

          return this.api.getVariantDetails(id).pipe(
            map(dto => this.mapDtoToProductDetails(dto, id)),
            catchError(() => of(null))
          );
        })
      )
      .subscribe((p) => {
        if (!p) {
          this.loading.set(false);
          this.notFound.set(true);
          this.applyNotFoundSeo();
          return;
        }

        this.product.set(p);
        this.loading.set(false);
        this.notFound.set(false);
        this.applySeo(p);
      });

    effect(() => {
      const p = this.product();
      if (!p) return;
      const sizes = (p.sizes ?? []).map(x => String(x));
      const sel = this.selectedSize();
      if (sel && !sizes.includes(sel)) this.selectedSize.set(null);
    });
  }

  private mapDtoToProductDetails(dto: any, id: string): ProductDetailsModel {
    const mediaBase = (environment.mediaProductBaseUrl ?? '').replace(/\/$/, '');
    const mkImg = (file?: string) =>
      file ? `${mediaBase}/${file}` : 'assets/images/placeholder.png';

    const images = Array.isArray(dto?.images) ? dto.images : [];
    const displayed = images.find((x: any) => x?.displayed) ?? images[0];
    const main = mkImg(displayed?.url);

    const gallery = images.length
      ? images.map((img: any) => {
        const u = mkImg(img?.url);
        return {
          desktop: u,
          mobile: u,
          alt: dto?.productName ?? dto?.name ?? 'Proizvod',
          w: 1200,
          h: 1200,
        };
      })
      : [{
        desktop: main,
        mobile: main,
        alt: dto?.productName ?? dto?.name ?? 'Proizvod',
        w: 1200,
        h: 1200,
      }];

    const brand =
      dto?.brand ??
      (Array.isArray(dto?.categories)
        ? (dto.categories.find((c: any) => (c?.categoryName ?? '').toUpperCase() === 'BREND')?.value ?? '')
        : '');

    // Build size maps from dto.attributes
    const qtyMap: Record<string, number> = {};
    const idMap: Record<string, string> = {};

    if (Array.isArray(dto?.attributes)) {
      for (const a of dto.attributes) {
        if (String(a?.attributeName ?? '').toUpperCase() !== 'VELICINA') continue;

        const sizeValue = String(a?.value ?? '').trim(); // e.g. "M"
        const elementId = String(a?.id ?? '').trim();    // e.g. "edce8ea8-..."

        if (!sizeValue || !elementId) continue;

        qtyMap[sizeValue] = Number(a?.quantity ?? 0);
        idMap[sizeValue] = elementId;
      }
    }

    this.sizeQtyMap.set(qtyMap);
    this.sizeAttrElementIdMap.set(idMap);

    const smartSizeCompare = (a: string, b: string) => {
      const na = Number(a);
      const nb = Number(b);
      const aNum = !Number.isNaN(na);
      const bNum = !Number.isNaN(nb);
      if (aNum && bNum) return na - nb;
      if (aNum) return -1;
      if (bNum) return 1;
      return a.localeCompare(b);
    };

    const sizes = Object.keys(qtyMap).sort(smartSizeCompare);

    const price = Number(dto?.finalPrice ?? dto?.price ?? 0);
    const original = Number(dto?.originalPrice ?? dto?.oldPrice ?? 0);
    const oldPrice = original > price ? original : null;

    const inStock = Object.values(qtyMap).some(q => Number(q) > 0);

    return {
      id,
      slug: id,
      name: dto?.productName ?? dto?.name ?? 'Proizvod',
      subtitle: dto?.productSku ?? dto?.subtitle ?? undefined,
      sku: dto?.sku ?? dto?.productSku ?? undefined,
      price,
      oldPrice: oldPrice ?? undefined,
      currency: dto?.currency ?? 'RSD',
      brand: brand || '—',
      inStock,
      sizes,
      shortDescription: dto?.shortDescription ?? dto?.description ?? '',
      gallery,
    } as any;
  }

  private applySeo(p: ProductDetailsModel) {
    const t = `${p.name} | Planeta`;
    const d = (p.shortDescription ?? '').trim() || 'Detalji proizvoda.';

    const img = p.gallery?.[0]?.desktop || '';
    const url = typeof window !== 'undefined' ? window.location.href : '';

    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });

    this.meta.updateTag({ property: 'og:type', content: 'product' });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    if (img) this.meta.updateTag({ property: 'og:image', content: img });
    if (url) this.meta.updateTag({ property: 'og:url', content: url });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: d });
    if (img) this.meta.updateTag({ name: 'twitter:image', content: img });
  }

  private applyNotFoundSeo() {
    this.title.setTitle('Proizvod nije dostupan | Planeta');
    this.meta.updateTag({ name: 'description', content: 'Traženi proizvod nije dostupan ili ne postoji.' });
    this.meta.updateTag({ property: 'og:title', content: 'Proizvod nije dostupan' });
    this.meta.updateTag({ property: 'og:description', content: 'Traženi proizvod nije dostupan ili ne postoji.' });
  }

  setActive(i: number) {
    const g = this.gallery();
    if (!g.length) return;
    const clamped = Math.max(0, Math.min(i, g.length - 1));
    this.activeIndex.set(clamped);
  }
  prev() { this.setActive(this.activeIndex() - 1); }
  next() { this.setActive(this.activeIndex() + 1); }

  selectSize(size: string) { this.selectedSize.set(size); }

  addToCart() {
    const p = this.product();
    if (!p) return;

    const size = this.selectedSize();
    const hasSizes = (p.sizes?.length ?? 0) > 0;

    if (hasSizes && !size) return;

    // block if overall stock not available
    if (!this.inStockUi()) return;

    // require size attribute element id (the BE expects this)
    const sizeValue = hasSizes ? String(size) : '';
    const sizeAttrElementId = hasSizes ? this.sizeAttrElementIdMap()[sizeValue] : '';

    if (hasSizes) {
      const qty = Number(this.sizeQtyMap()[sizeValue] ?? 0);
      if (qty <= 0) return;
      if (!sizeAttrElementId) return; // without this id you cannot order
    }

    const img =
      p.gallery?.[0]?.mobile ||
      p.gallery?.[0]?.desktop ||
      '';

    // IMPORTANT:
    // Cart line id must start with size attribute element id, not product/variant id.
    const lineId = hasSizes ? `${sizeAttrElementId}::${sizeValue}` : p.id;

    this.cart.add({
      id: lineId,
      productId: p.id, // variant id for navigation; NOT used in order payload
      name: p.name,
      sku: p.sku,
      size: hasSizes ? sizeValue : null,

      image: img ? { url: img, alt: p.name } : null,

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

  onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping = true;
  }
  onTouchMove(_: TouchEvent) { if (!this.isSwiping) return; }
  onTouchEnd(e: TouchEvent) {
    if (!this.isSwiping) return;
    this.isSwiping = false;

    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;

    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) this.next();
    else this.prev();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }
}
