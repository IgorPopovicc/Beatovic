import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ProductsApiService } from '../../core/api/products-api.service';
import { ProductsSearchRequest, ProductSearchResponse, Variant } from '../../core/api/catalog.models';
import { ProductCardComponent, ProductCard } from '../../shared/ui/product-card/product-card';
import { mapVariantToProductCard } from '../../shared/ui/product-card/product-card.mapper';
import { CatalogApiService } from '../../core/api/catalog-api.sevice';
import { fromSlug, toLabel } from '../../core/api/catalog-slug';
import { SeoService } from '../../core/seo/seo.service';

type SortKey = 'novo' | 'cijena_rastuce' | 'cijena_opadajuce';
type SortBy = 'NAME' | 'PRICE';
type SortOrder = 'ASC' | 'DESC';

type FilterOption = {
  id: string;
  label: string;
  count: number;
  selected: boolean;
};

type RouteContext = {
  genderSlug: string;
  categorySlug: string;
  searchQuery: string;
  forceSale: boolean;
  initialCategoryFilters: Record<string, string[]>;
};

type RouteResolution =
  | {
      ok: true;
      context: RouteContext;
    }
  | {
      ok: false;
      reason: 'catalog_unavailable' | 'category_not_found';
      message: string;
      genderSlug: string;
      categorySlug: string;
    };

type ProductsRequestState = {
  searchQuery: string;
  initialCategoryFilters: Record<string, string[]>;
  categoryFilters: Record<string, string[]>;
  attributeFilters: Record<string, string[]>;
  minPrice: number | null;
  maxPrice: number | null;
  hasActiveDiscount: boolean | null;
  hasActiveStock: boolean | null;
  page: number; // backend is 0-based
  pageSize: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
};

const DEFAULT_PAGE_SIZE = 24;

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly productsApi = inject(ProductsApiService);
  private readonly seo = inject(SeoService);

  private routeSub?: Subscription;
  private searchSub?: Subscription;

  filtersOpen = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);

  response = signal<ProductSearchResponse | null>(null);
  private currentContext = signal<RouteContext | null>(null);
  private requestState = signal<ProductsRequestState | null>(null);

  private readonly genderSlug = signal('');
  private readonly categorySlug = signal('');

  heading = computed(() => {
    const gender = this.genderSlug();
    const category = this.categorySlug();
    const g = gender ? toLabel(fromSlug(gender)) : '';
    const c = category ? toLabel(fromSlug(category)) : '';
    return [g, c].filter(Boolean).join(' / ');
  });

  private readonly brandCategoryGroup = computed(() => {
    const categories = this.response()?.availableCategories ?? [];
    return categories.find((c) => this.normalizeKey(c.name) === 'BREND') ?? null;
  });

  private readonly sizeAttributeGroup = computed(() => {
    const attributes = this.response()?.availableAttributes ?? [];
    return attributes.find((a) => this.normalizeKey(a.name) === 'VELICINA') ?? null;
  });

  availableBrands = computed<FilterOption[]>(() => {
    const group = this.brandCategoryGroup();
    if (!group?.values?.length) return [];

    const selected = this.selectedCategoryValueIds(group.id);
    return group.values
      .map((v) => ({
        id: v.id,
        label: String(v.displayValue ?? v.value ?? '').trim(),
        count: Number(v.count ?? 0),
        selected: v.alreadySelected ?? selected.has(v.id),
      }))
      .filter((v) => !!v.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  availableSizes = computed<FilterOption[]>(() => {
    const group = this.sizeAttributeGroup();
    if (!group?.values?.length) return [];

    const selected = this.selectedAttributeValueIds(group.id);
    return group.values
      .map((v) => ({
        id: v.id,
        label: String(v.displayValue ?? v.value ?? '').trim(),
        count: Number(v.count ?? 0),
        selected: v.alreadySelected ?? selected.has(v.id),
      }))
      .filter((v) => !!v.label)
      .sort((a, b) => this.smartSizeCompare(a.label, b.label));
  });

  priceBounds = computed(() => {
    const range = this.response()?.priceRange;
    return {
      min: Number(range?.minPrice ?? 0),
      max: Number(range?.maxPrice ?? 0),
    };
  });

  onlyInStock = computed(() => this.requestState()?.hasActiveStock === true);
  onlySale = computed(() => this.requestState()?.hasActiveDiscount === true);
  minPrice = computed(() => this.requestState()?.minPrice ?? null);
  maxPrice = computed(() => this.requestState()?.maxPrice ?? null);

  sortKey = computed<SortKey>(() => {
    const state = this.requestState();
    if (!state) return 'novo';
    return this.backendSortToUi(state.sortBy, state.sortOrder);
  });

  page = computed(() => (this.requestState()?.page ?? 0) + 1);
  pageSize = computed(() => this.requestState()?.pageSize ?? DEFAULT_PAGE_SIZE);

  allProducts = computed<ProductCard[]>(() => {
    const variants = this.response()?.variants ?? [];
    return variants.map((v) => this.mapVariantToProductCard(v));
  });

  // Backend already handles pagination/filtering. We render returned page as-is.
  pagedProducts = computed(() => this.allProducts());

  totalCount = computed(() => Number(this.response()?.totalResults ?? 0));

  totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    const total = this.totalCount();
    return Math.max(1, Math.ceil(total / size));
  });

  ngOnInit(): void {
    const polId$ = this.catalogApi.getCategoryIdByName('POL');
    const katId$ = this.catalogApi.getCategoryIdByName('KATEGORIJA');

    this.routeSub = combineLatest([polId$, katId$, this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([polId, katId, params, queryParams]) => {
          const genderSlug = params.get('gender') ?? '';
          const categorySlug = params.get('category') ?? '';
          const searchQuery = (queryParams.get('q') ?? '').trim();
          const forceSale = this.queryParamToBool(queryParams.get('sale'));

          this.genderSlug.set(genderSlug);
          this.categorySlug.set(categorySlug);

          if (!polId || !katId) {
            return of<RouteResolution>({
              ok: false,
              reason: 'catalog_unavailable',
              message: 'Katalog trenutno nije dostupan.',
              genderSlug,
              categorySlug,
            });
          }

          return combineLatest([
            this.catalogApi.getCategoryValues(polId),
            this.catalogApi.getCategoryValues(katId),
          ]).pipe(
            map(([polValues, katValues]) => {
              const genderApiValue = fromSlug(genderSlug);
              const categoryApiValue = fromSlug(categorySlug);

              const genderValue = polValues.find(
                (v) => this.normalizeKey(v.value) === this.normalizeKey(genderApiValue),
              );
              const categoryValue = katValues.find(
                (v) => this.normalizeKey(v.value) === this.normalizeKey(categoryApiValue),
              );

              if (!genderValue || !categoryValue) {
                return {
                  ok: false,
                  reason: 'category_not_found',
                  message: 'Tražena kategorija nije pronađena.',
                  genderSlug,
                  categorySlug,
                } satisfies RouteResolution;
              }

              return {
                ok: true,
                context: {
                  genderSlug,
                  categorySlug,
                  searchQuery,
                  forceSale,
                  initialCategoryFilters: {
                    [polId]: [genderValue.id],
                    [katId]: [categoryValue.id],
                  },
                },
              } satisfies RouteResolution;
            }),
            catchError(() =>
              of<RouteResolution>({
                ok: false,
                reason: 'catalog_unavailable',
                message: 'Katalog trenutno nije dostupan.',
                genderSlug,
                categorySlug,
              }),
            ),
          );
        }),
      )
      .subscribe((resolution) => {
        if (!resolution.ok) {
          this.handleRouteError(resolution);
          return;
        }

        this.error.set(null);
        this.response.set(null);
        this.currentContext.set(resolution.context);
        this.requestState.set(this.createDefaultRequestState(resolution.context));
        this.applySeo(resolution.context.genderSlug, resolution.context.categorySlug);
        this.runSearch();
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  openFilters(): void {
    this.filtersOpen.set(true);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  setSort(key: string): void {
    const sortKey = (key as SortKey) ?? 'novo';
    const sort = this.uiSortToBackend(sortKey);
    this.patchRequestState((prev) => ({ ...prev, ...sort, page: 0 }));
  }

  setInStock(v: boolean): void {
    this.patchRequestState((prev) => ({
      ...prev,
      hasActiveStock: v ? true : null,
      page: 0,
    }));
  }

  setSale(v: boolean): void {
    this.patchRequestState((prev) => ({
      ...prev,
      hasActiveDiscount: v ? true : null,
      page: 0,
    }));
  }

  toggleBrand(valueId: string): void {
    const group = this.brandCategoryGroup();
    if (!group?.id) return;

    this.patchRequestState((prev) => {
      const current = new Set(prev.categoryFilters[group.id] ?? []);
      current.has(valueId) ? current.delete(valueId) : current.add(valueId);

      const categoryFilters = { ...prev.categoryFilters };
      if (current.size > 0) {
        categoryFilters[group.id] = Array.from(current);
      } else {
        delete categoryFilters[group.id];
      }

      return { ...prev, categoryFilters, page: 0 };
    });
  }

  toggleSize(valueId: string): void {
    const group = this.sizeAttributeGroup();
    if (!group?.id) return;

    this.patchRequestState((prev) => {
      const current = new Set(prev.attributeFilters[group.id] ?? []);
      current.has(valueId) ? current.delete(valueId) : current.add(valueId);

      const attributeFilters = { ...prev.attributeFilters };
      if (current.size > 0) {
        attributeFilters[group.id] = Array.from(current);
      } else {
        delete attributeFilters[group.id];
      }

      return { ...prev, attributeFilters, page: 0 };
    });
  }

  applyPrice(minRaw: string, maxRaw: string): void {
    const min = minRaw?.trim() ? Number(minRaw) : null;
    const max = maxRaw?.trim() ? Number(maxRaw) : null;

    const parsedMin = min !== null && !Number.isNaN(min) ? min : null;
    const parsedMax = max !== null && !Number.isNaN(max) ? max : null;

    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      this.error.set('Minimalna cijena ne može biti veća od maksimalne.');
      return;
    }

    this.patchRequestState((prev) => ({
      ...prev,
      minPrice: parsedMin,
      maxPrice: parsedMax,
      page: 0,
    }));
  }

  clearPrice(): void {
    this.patchRequestState((prev) => ({
      ...prev,
      minPrice: null,
      maxPrice: null,
      page: 0,
    }));
  }

  resetFilters(keepSidebarState: boolean): void {
    const context = this.currentContext();
    const state = this.requestState();
    if (!context || !state) return;

    this.requestState.set({
      ...this.createDefaultRequestState(context),
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    });

    if (!keepSidebarState) this.closeFilters();
    this.runSearch();
  }

  goPage(p: number): void {
    const max = this.totalPages();
    const clamped = Math.max(1, Math.min(p, max));
    this.patchRequestState((prev) => ({ ...prev, page: clamped - 1 }));
  }

  retryLoad(): void {
    this.runSearch();
  }

  private patchRequestState(mutator: (prev: ProductsRequestState) => ProductsRequestState): void {
    const prev = this.requestState();
    if (!prev) return;
    const next = mutator(prev);
    this.requestState.set(next);
    this.runSearch();
  }

  private runSearch(): void {
    const state = this.requestState();
    if (!state) return;

    this.loading.set(true);
    this.error.set(null);

    const body = this.buildRequestBody(state);
    this.searchSub?.unsubscribe();

    this.searchSub = this.productsApi.search(body).subscribe({
      next: (res) => {
        this.response.set(res ?? null);
        this.loading.set(false);
        this.applyCollectionStructuredData();
      },
      error: (e) => {
        console.error(e);
        this.response.set(null);
        this.loading.set(false);
        this.error.set('Trenutno ne možemo učitati katalog. Molimo pokušajte ponovo.');
      },
    });
  }

  private buildRequestBody(state: ProductsRequestState): ProductsSearchRequest {
    const body: ProductsSearchRequest = {
      initialCategoryFilters: state.initialCategoryFilters,
      page: state.page,
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    };

    if (state.searchQuery) body.searchQuery = state.searchQuery;
    if (Object.keys(state.categoryFilters).length > 0) body.categoryFilters = state.categoryFilters;
    if (Object.keys(state.attributeFilters).length > 0) {
      body.attributeFilters = state.attributeFilters;
    }
    if (state.minPrice !== null) body.minPrice = state.minPrice;
    if (state.maxPrice !== null) body.maxPrice = state.maxPrice;
    if (state.hasActiveDiscount !== null) body.hasActiveDiscount = state.hasActiveDiscount;
    if (state.hasActiveStock !== null) body.hasActiveStock = state.hasActiveStock;

    return body;
  }

  private createDefaultRequestState(context: RouteContext): ProductsRequestState {
    return {
      searchQuery: context.searchQuery,
      initialCategoryFilters: context.initialCategoryFilters,
      categoryFilters: {},
      attributeFilters: {},
      minPrice: null,
      maxPrice: null,
      hasActiveDiscount: context.forceSale ? true : null,
      hasActiveStock: null,
      page: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'NAME',
      sortOrder: 'ASC',
    };
  }

  private handleRouteError(resolution: Exclude<RouteResolution, { ok: true }>): void {
    this.currentContext.set(null);
    this.requestState.set(null);
    this.response.set(null);
    this.loading.set(false);
    this.error.set(resolution.message);

    if (resolution.reason === 'catalog_unavailable') {
      this.seo.setPage({
        title: 'Katalog trenutno nije dostupan | Planeta',
        description: 'Podaci za katalog trenutno nisu dostupni. Molimo pokušajte ponovo kasnije.',
        path: '/catalog',
        noindex: true,
      });
      this.seo.clearStructuredData();
      return;
    }

    this.seo.setPage({
      title: 'Kategorija nije pronađena | Planeta',
      description: 'Tražena kategorija ne postoji ili je uklonjena iz ponude.',
      path: `/catalog/${resolution.genderSlug}/${resolution.categorySlug}`,
      noindex: true,
    });
    this.seo.clearStructuredData();
  }

  private applySeo(genderSlug: string, categorySlug: string): void {
    const genderLabel = genderSlug ? toLabel(fromSlug(genderSlug)) : 'Proizvodi';
    const categoryLabel = categorySlug ? toLabel(fromSlug(categorySlug)) : '';
    const joined = [genderLabel, categoryLabel].filter(Boolean).join(' / ');

    this.seo.setPage({
      title: `${joined} | Planeta`,
      description: `Pregled ponude za ${joined.toLowerCase()} uz filtere po veličini, brendu i cijeni.`,
      path: `/catalog/${genderSlug}/${categorySlug}`,
      ogType: 'website',
    });
  }

  private applyCollectionStructuredData(): void {
    const products = this.allProducts().slice(0, 12);
    if (!products.length) {
      this.seo.clearStructuredData();
      return;
    }

    const gender = this.genderSlug();
    const category = this.categorySlug();
    const path = gender && category ? `/catalog/${gender}/${category}` : '/catalog';

    const listItems = products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: this.seo.absoluteUrl(`/product/${p.id}`),
      name: p.name,
    }));

    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: this.heading() || 'Katalog',
      url: this.seo.absoluteUrl(path),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: listItems,
      },
    });
  }

  private selectedCategoryValueIds(groupId: string): Set<string> {
    const selected = this.requestState()?.categoryFilters?.[groupId] ?? [];
    return new Set(selected);
  }

  private selectedAttributeValueIds(groupId: string): Set<string> {
    const selected = this.requestState()?.attributeFilters?.[groupId] ?? [];
    return new Set(selected);
  }

  private uiSortToBackend(key: SortKey): { sortBy: SortBy; sortOrder: SortOrder } {
    if (key === 'cijena_rastuce') return { sortBy: 'PRICE', sortOrder: 'ASC' };
    if (key === 'cijena_opadajuce') return { sortBy: 'PRICE', sortOrder: 'DESC' };
    return { sortBy: 'NAME', sortOrder: 'ASC' };
  }

  private backendSortToUi(sortBy: SortBy, sortOrder: SortOrder): SortKey {
    if (sortBy === 'PRICE' && sortOrder === 'ASC') return 'cijena_rastuce';
    if (sortBy === 'PRICE' && sortOrder === 'DESC') return 'cijena_opadajuce';
    return 'novo';
  }

  private mapVariantToProductCard(v: Variant): ProductCard {
    return mapVariantToProductCard(v);
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

  private normalizeKey(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toUpperCase()
      .trim();
  }

  private queryParamToBool(value: string | null): boolean {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
}
