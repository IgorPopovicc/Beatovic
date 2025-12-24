// src/app/features/products/products.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { ProductsApiService } from '../../core/api/products-api.service';
import { ProductSearchResponse, Variant } from '../../core/api/catalog.models';

import { ProductCardComponent, ProductCard } from '../../shared/ui/product-card/product-card';
import { CatalogApiService } from '../../core/api/catalog-api.sevice';
import { fromSlug, toLabel } from '../../core/api/catalog-slug'; // <- provjeri putanju
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  private route = inject(ActivatedRoute);
  private catalogApi = inject(CatalogApiService);
  private productsApi = inject(ProductsApiService);
  private platformId = inject(PLATFORM_ID);

  filtersOpen = signal(false);

  sortKey = signal<'novo' | 'cijena_rastuce' | 'cijena_opadajuce'>('novo');

  onlyInStock = signal(false);
  onlySale = signal(false);

  selectedBrands = signal<Set<string>>(new Set());
  selectedSizes = signal<Set<string>>(new Set());

  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);

  page = signal(1);
  pageSize = signal(24);

  loading = signal(true);
  error = signal<string | null>(null);

  response = signal<ProductSearchResponse | null>(null);

  private variantById = computed(() => {
    const res = this.response();
    const map = new Map<string, Variant>();
    for (const v of res?.variants ?? []) map.set(v.id, v);
    return map;
  });

  allProducts = computed<ProductCard[]>(() => {
    const res = this.response();
    if (!res?.variants?.length) return [];
    return res.variants.map(v => this.mapVariantToProductCard(v));
  });

  heading = computed(() => {
    const p = this.route.snapshot.paramMap;
    const gender = p.get('gender') ?? '';
    const category = p.get('category') ?? '';
    const g = gender ? toLabel(fromSlug(gender)) : '';
    const c = category ? toLabel(fromSlug(category)) : '';
    return [g, c].filter(Boolean).join(' / ');
  });

  availableBrands = computed(() => {
    const res = this.response();
    const cat = res?.availableCategories?.find(c => (c.name ?? '').toUpperCase() === 'BREND');
    if (cat?.values?.length) {
      return cat.values
        .map(v => ({ brand: v.value, count: v.count }))
        .sort((a, b) => a.brand.localeCompare(b.brand));
    }

    const map = new Map<string, number>();
    const byId = this.variantById();
    for (const p of this.allProducts()) {
      const v = byId.get(p.id);
      const brand = v ? this.getCategoryValue(v, 'BREND') : null;
      if (!brand) continue;
      map.set(brand, (map.get(brand) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  });

  availableSizes = computed(() => {
    const res = this.response();
    const attr = res?.availableAttributes?.find(a => (a.name ?? '').toUpperCase() === 'VELICINA');
    if (attr?.values?.length) {
      return attr.values
        .map(v => ({ size: v.value, count: v.count }))
        .sort((a, b) => this.smartSizeCompare(a.size, b.size));
    }

    const map = new Map<string, number>();
    const byId = this.variantById();
    for (const p of this.allProducts()) {
      const v = byId.get(p.id);
      if (!v) continue;
      const sizes = this.getAttributeValues(v, 'VELICINA');
      for (const s of sizes) map.set(s, (map.get(s) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => this.smartSizeCompare(a.size, b.size));
  });

  priceBounds = computed(() => {
    const res = this.response();
    if (res?.priceRange) {
      return { min: res.priceRange.minPrice ?? 0, max: res.priceRange.maxPrice ?? 0 };
    }
    const prices = this.allProducts().map(p => p.price);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  });

  filteredProducts = computed(() => {
    let list = this.allProducts();
    const byId = this.variantById();

    if (this.onlyInStock()) {
      list = list.filter(p => (byId.get(p.id)?.quantity ?? 0) > 0);
    }

    if (this.onlySale()) {
      list = list.filter(p => {
        const v = byId.get(p.id);
        if (!v) return false;
        return (v.discountPrice ?? 0) > 0 || (v.finalPrice ?? 0) < (v.originalPrice ?? 0);
      });
    }

    const brands = this.selectedBrands();
    if (brands.size) {
      list = list.filter(p => {
        const v = byId.get(p.id);
        const brand = v ? this.getCategoryValue(v, 'BREND') : null;
        return brand ? brands.has(brand) : false;
      });
    }

    const sizes = this.selectedSizes();
    if (sizes.size) {
      list = list.filter(p => {
        const v = byId.get(p.id);
        if (!v) return false;
        const vsizes = this.getAttributeValues(v, 'VELICINA');
        return vsizes.some(s => sizes.has(s));
      });
    }

    const minP = this.minPrice();
    const maxP = this.maxPrice();
    if (minP !== null && !Number.isNaN(minP)) list = list.filter(p => p.price >= minP);
    if (maxP !== null && !Number.isNaN(maxP)) list = list.filter(p => p.price <= maxP);

    const key = this.sortKey();
    if (key === 'cijena_rastuce') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (key === 'cijena_opadajuce') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else {
      list = [...list].sort((a, b) => {
        const av = byId.get(a.id);
        const bv = byId.get(b.id);
        const an = av?.new ? 1 : 0;
        const bn = bv?.new ? 1 : 0;
        return bn - an;
      });
    }

    return list;
  });

  totalCount = computed(() => this.filteredProducts().length);

  totalPages = computed(() => {
    const size = this.pageSize();
    const total = this.totalCount();
    return Math.max(1, Math.ceil(total / size));
  });

  pagedProducts = computed(() => {
    const p = this.page();
    const size = this.pageSize();
    const list = this.filteredProducts();
    const start = (p - 1) * size;
    return list.slice(start, start + size);
  });

  ngOnInit() {
    const polId$ = this.catalogApi.getCategoryIdByName('POL');
    const katId$ = this.catalogApi.getCategoryIdByName('KATEGORIJA');

    combineLatest([polId$, katId$, this.route.paramMap])
      .pipe(
        switchMap(([polId, katId, params]) => {
          this.loading.set(true);
          this.error.set(null);

          this.resetFilters(true);
          this.page.set(1);

          if (!polId || !katId) {
            this.loading.set(false);
            this.error.set('Nedostaje POL/KATEGORIJA ID.');
            return of(null);
          }

          const genderSlug = params.get('gender') ?? '';
          const categorySlug = params.get('category') ?? '';

          const genderApiValue = fromSlug(genderSlug);
          const categoryApiValue = fromSlug(categorySlug);

          return combineLatest([
            this.catalogApi.getCategoryValues(polId),
            this.catalogApi.getCategoryValues(katId),
          ]).pipe(
            switchMap(([polValues, katValues]) => {
              const genderValue = polValues.find(v => v.value === genderApiValue);
              const categoryValue = katValues.find(v => v.value === categoryApiValue);

              if (!genderValue || !categoryValue) {
                this.loading.set(false);
                this.error.set('Nepoznata ruta (gender/category).');
                return of(null);
              }

              const body = {
                initialCategoryFilters: {
                  [polId]: [genderValue.id],
                  [katId]: [categoryValue.id],
                },
              };

              return this.productsApi.search(body);
            })
          );
        })
      )
      .subscribe({
        next: (res) => {
          this.response.set(res);
          this.loading.set(false);

          if (isPlatformBrowser(this.platformId)) {
            // ništa agresivno ovde
          }
        },
        error: (e) => {
          console.error(e);
          this.loading.set(false);
          this.error.set('Search nije uspeo.');
        },
      });
  }

  openFilters() { this.filtersOpen.set(true); }
  closeFilters() { this.filtersOpen.set(false); }

  setSort(key: string) {
    const k = key as 'novo' | 'cijena_rastuce' | 'cijena_opadajuce';
    this.sortKey.set(k);
    this.page.set(1);
  }

  setInStock(v: boolean) { this.onlyInStock.set(!!v); this.page.set(1); }
  setSale(v: boolean) { this.onlySale.set(!!v); this.page.set(1); }

  toggleBrand(brand: string) {
    const next = new Set(this.selectedBrands());
    next.has(brand) ? next.delete(brand) : next.add(brand);
    this.selectedBrands.set(next);
    this.page.set(1);
  }

  toggleSize(size: string) {
    const next = new Set(this.selectedSizes());
    next.has(size) ? next.delete(size) : next.add(size);
    this.selectedSizes.set(next);
    this.page.set(1);
  }

  applyPrice(minRaw: string, maxRaw: string) {
    const min = minRaw?.trim() ? Number(minRaw) : null;
    const max = maxRaw?.trim() ? Number(maxRaw) : null;

    this.minPrice.set(min !== null && !Number.isNaN(min) ? min : null);
    this.maxPrice.set(max !== null && !Number.isNaN(max) ? max : null);
    this.page.set(1);
  }

  clearPrice() { this.minPrice.set(null); this.maxPrice.set(null); this.page.set(1); }

  resetFilters(keepSidebarState: boolean) {
    this.onlyInStock.set(false);
    this.onlySale.set(false);
    this.selectedBrands.set(new Set());
    this.selectedSizes.set(new Set());
    this.minPrice.set(null);
    this.maxPrice.set(null);

    if (!keepSidebarState) this.closeFilters();
    this.page.set(1);
  }

  goPage(p: number) {
    const max = this.totalPages();
    this.page.set(Math.min(Math.max(1, p), max));
  }

  private mapVariantToProductCard(v: Variant): ProductCard {
    const displayed = v.images?.find(i => i.displayed) ?? v.images?.[0];
    const imgFile = displayed?.url ?? '';

    const imgUrl = imgFile
      ? `${environment.mediaProductBaseUrl}/${imgFile}`
      : 'assets/images/placeholder.png';

    const hasDiscount = (v.finalPrice ?? 0) < (v.originalPrice ?? 0);
    const oldPrice = hasDiscount ? Number(v.originalPrice ?? 0) : null;

    return {
      id: v.id,
      slug: this.slugify(`${v.productName}-${v.sku ?? v.id}`),
      name: v.productName,
      subtitle: v.productSku ?? undefined,
      price: Number(v.finalPrice ?? 0),
      oldPrice,
      currency: 'RSD',
      discountLabel: undefined,
      image: {
        desktop: imgUrl,
        mobile: imgUrl,
        alt: v.productName,
        w: 1200,
        h: 1200,
      },
      priority: false,
    };
  }

  private getCategoryValue(v: Variant, categoryName: string): string | null {
    const t = categoryName.toUpperCase();
    const hit = v.categories?.find(c => (c.categoryName ?? '').toUpperCase() === t);
    return hit?.value ?? null;
  }

  private getAttributeValues(v: Variant, attrName: string): string[] {
    const t = attrName.toUpperCase();
    return (v.attributes ?? [])
      .filter(a => (a.attributeName ?? '').toUpperCase() === t)
      .map(a => a.value)
      .filter(Boolean);
  }

  private smartSizeCompare(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
