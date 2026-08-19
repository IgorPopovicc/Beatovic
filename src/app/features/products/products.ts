import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ProductsApiService } from '../../core/api/products-api.service';
import {
  ApiCategoryValue,
  ProductsSearchRequest,
  ProductSearchResponse,
  Variant,
} from '../../core/api/catalog.models';
import { ProductCardComponent, ProductCard } from '../../shared/ui/product-card/product-card';
import { mapVariantToProductCard } from '../../shared/ui/product-card/product-card.mapper';
import { CatalogApiService } from '../../core/api/catalog-api.sevice';
import { fromSlug, toLabel, toSlug } from '../../core/api/catalog-slug';
import { SeoService } from '../../core/seo/seo.service';
import { colorSwatchLabel, parseColorSwatch } from '../../shared/utils/color-swatch';
import { CategoryVisibilityService } from '../../core/api/category-visibility.service';

type SortKey = 'preporucujemo' | 'naziv_az' | 'naziv_za' | 'cijena_rastuce' | 'cijena_opadajuce';
type SortBy = 'PRIORITY' | 'NAME' | 'PRICE';
type SortOrder = 'ASC' | 'DESC';

type FilterOption = {
  id: string;
  label: string;
  count: number;
  selected: boolean;
};

type ColorFilterOption = FilterOption & { background: string };

type CategoryNavigationOption = FilterOption & { link: string };

type RouteContext = {
  genderSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  searchQuery: string;
  searchMode: boolean;
  forceSale: boolean;
  initialCategoryFilters: Record<string, string[]>;
  categoryFilters: Record<string, string[]>;
  categoryCategoryId: string | null;
  parentCategoryValue: ApiCategoryValue | null;
  rawCategoryChildren: ApiCategoryValue[];
  categoryChildLinkPrefix: string;
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
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly categoryVisibility = inject(CategoryVisibilityService);
  private readonly productsApi = inject(ProductsApiService);
  private readonly seo = inject(SeoService);
  private readonly viewportScroller = inject(ViewportScroller);

  private routeSub?: Subscription;
  private searchSub?: Subscription;
  private scrollAfterPageLoad = false;

  filtersOpen = signal(false);
  loading = signal(true);
  error = signal<string | null>(null);

  response = signal<ProductSearchResponse | null>(null);
  private currentContext = signal<RouteContext | null>(null);
  private requestState = signal<ProductsRequestState | null>(null);

  private readonly genderSlug = signal('');
  private readonly categorySlug = signal('');
  private readonly subcategorySlug = signal('');

  searchTerm = computed(() => this.requestState()?.searchQuery?.trim() ?? '');
  isSearchMode = computed(() => this.searchTerm().length > 0);
  isAllProductsMode = computed(() => {
    if (this.isSearchMode()) return false;
    return !this.genderSlug() && !this.categorySlug() && !this.subcategorySlug();
  });

  heading = computed(() => {
    if (this.isSearchMode()) {
      return `Rezultati pretrage za "${this.searchTerm()}"`;
    }

    if (this.isAllProductsMode()) {
      return 'Svi proizvodi';
    }

    const gender = this.genderSlug();
    const category = this.categorySlug();
    const subcategory = this.subcategorySlug();
    const g = gender ? toLabel(fromSlug(gender)) : '';
    const c = category ? toLabel(fromSlug(category)) : '';
    const s = subcategory ? toLabel(fromSlug(subcategory)) : '';
    return [g, c, s].filter(Boolean).join(' / ');
  });

  sectionLabel = computed(() => {
    if (this.isSearchMode() || this.isAllProductsMode()) return 'Sve kategorije';
    return this.heading();
  });

  private readonly brandCategoryGroup = computed(() => {
    const categories = this.response()?.availableCategories ?? [];
    return categories.find((c) => this.normalizeKey(c.name) === 'BREND') ?? null;
  });

  private readonly sizeAttributeGroup = computed(() => {
    const attributes = this.response()?.availableAttributes ?? [];
    return attributes.find((a) => this.normalizeKey(a.name) === 'VELICINA') ?? null;
  });

  private readonly colorAttributeGroup = computed(() => {
    const attributes = this.response()?.availableAttributes ?? [];
    return attributes.find((a) => this.normalizeKey(a.name) === 'BOJA') ?? null;
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

  visibleCategoryChildren = computed<CategoryNavigationOption[]>(() => {
    const context = this.currentContext();
    const response = this.response();
    if (
      !context?.categoryCategoryId ||
      !context.parentCategoryValue ||
      !context.rawCategoryChildren.length ||
      !context.categoryChildLinkPrefix ||
      !response
    ) {
      return [];
    }

    const selectedIds = this.selectedCategoryValueIds(context.categoryCategoryId);
    return this.categoryVisibility
      .deriveVisibleChildren(
        context.categoryCategoryId,
        context.rawCategoryChildren,
        response.availableCategories ?? [],
      )
      .flatMap((child) => {
        const slug = toSlug(child.value);
        const label = String(child.displayValue ?? '').trim() || toLabel(child.value);
        if (!slug || !label) return [];

        return [
          {
            id: child.id,
            label,
            count: child.count,
            selected: selectedIds.has(child.id),
            link: `${context.categoryChildLinkPrefix}/${slug}`,
          },
        ];
      });
  });

  showCategoryNavigation = computed(() => {
    const context = this.currentContext();
    return !!context?.parentCategoryValue && context.rawCategoryChildren.length > 0;
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

  availableColors = computed<ColorFilterOption[]>(() => {
    const group = this.colorAttributeGroup();
    if (!group?.values?.length) return [];

    const selected = this.selectedAttributeValueIds(group.id);
    return group.values
      .map((v) => {
        const raw = String(v.displayValue ?? v.value ?? '').trim();
        const swatch = parseColorSwatch(raw);
        if (!swatch) return null;
        return {
          id: v.id,
          label: colorSwatchLabel(raw),
          background: swatch.background,
          count: Number(v.count ?? 0),
          selected: v.alreadySelected ?? selected.has(v.id),
        } satisfies ColorFilterOption;
      })
      .filter((value): value is ColorFilterOption => value !== null);
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
    if (!state) return 'preporucujemo';
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
    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, queryParams]) => {
          // Cancel the previous route's product request before resolving the new runtime IDs.
          // This prevents a slower response from repainting stale gender/category facets.
          this.searchSub?.unsubscribe();
          this.searchSub = undefined;
          this.response.set(null);
          this.loading.set(true);
          this.error.set(null);

          const genderSlug = params.get('gender') ?? '';
          const sectionSlug = params.get('section') ?? '';
          const categorySlug = params.get('category') ?? sectionSlug;
          const subcategorySlug = params.get('subcategory') ?? '';
          const searchQuery = (queryParams.get('search') ?? queryParams.get('q') ?? '').trim();
          const forceSale = this.queryParamToBool(queryParams.get('sale'));

          this.genderSlug.set(genderSlug);
          this.categorySlug.set(categorySlug);
          this.subcategorySlug.set(subcategorySlug);

          if (searchQuery) {
            return of<RouteResolution>({
              ok: true,
              context: {
                genderSlug,
                categorySlug,
                subcategorySlug,
                searchQuery,
                searchMode: true,
                forceSale,
                initialCategoryFilters: {},
                categoryFilters: {},
                categoryCategoryId: null,
                parentCategoryValue: null,
                rawCategoryChildren: [],
                categoryChildLinkPrefix: '',
              },
            });
          }

          if (!genderSlug && !categorySlug && !subcategorySlug) {
            return of<RouteResolution>({
              ok: true,
              context: {
                genderSlug,
                categorySlug,
                subcategorySlug,
                searchQuery: '',
                searchMode: false,
                forceSale,
                initialCategoryFilters: {},
                categoryFilters: {},
                categoryCategoryId: null,
                parentCategoryValue: null,
                rawCategoryChildren: [],
                categoryChildLinkPrefix: '',
              },
            });
          }

          if (sectionSlug) {
            return this.catalogApi.getCategoryIdByName('KATEGORIJA').pipe(
              switchMap((katId) => {
                if (!katId) {
                  return of<RouteResolution>({
                    ok: false,
                    reason: 'catalog_unavailable',
                    message: 'Katalog trenutno nije dostupan.',
                    genderSlug,
                    categorySlug,
                  });
                }

                return this.catalogApi.getCategoryValues(katId, { onlyRoot: true }).pipe(
                  switchMap((values) => {
                    const category = values.find(
                      (value) =>
                        this.normalizeKey(value.value) === this.normalizeKey(fromSlug(sectionSlug)),
                    );
                    if (!category) {
                      return of({
                        ok: false,
                        reason: 'category_not_found',
                        message: 'Tražena kategorija nije pronađena.',
                        genderSlug,
                        categorySlug,
                      } satisfies RouteResolution);
                    }

                    return this.catalogApi.getCategoryChildren(category.id).pipe(
                      map(
                        (children) =>
                          ({
                            ok: true,
                            context: {
                              genderSlug: '',
                              categorySlug: sectionSlug,
                              subcategorySlug: '',
                              searchQuery: '',
                              searchMode: false,
                              forceSale,
                              initialCategoryFilters: {},
                              categoryFilters: { [katId]: [category.id] },
                              categoryCategoryId: katId,
                              parentCategoryValue: category,
                              rawCategoryChildren: children,
                              categoryChildLinkPrefix: `/catalog/${sectionSlug}`,
                            },
                          }) satisfies RouteResolution,
                      ),
                    );
                  }),
                );
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
          }

          return forkJoin([
            this.catalogApi.getCategoryIdByName('POL'),
            this.catalogApi.getCategoryIdByName('KATEGORIJA'),
          ]).pipe(
            switchMap(([polId, katId]) => {
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
                this.catalogApi.getCategoryValues(polId, { onlyRoot: true }),
                this.catalogApi.getCategoryValues(katId, { onlyRoot: true }),
              ]).pipe(
                switchMap(([polValues, katValues]) => {
                  const genderApiValue = fromSlug(genderSlug);
                  const categoryApiValue = fromSlug(categorySlug);

                  const genderValue = polValues.find(
                    (v) => this.normalizeKey(v.value) === this.normalizeKey(genderApiValue),
                  );
                  const categoryValue = katValues.find(
                    (v) => this.normalizeKey(v.value) === this.normalizeKey(categoryApiValue),
                  );

                  const standaloneParent =
                    !subcategorySlug && !genderValue
                      ? katValues.find(
                          (v) => this.normalizeKey(v.value) === this.normalizeKey(genderApiValue),
                        )
                      : null;

                  if (standaloneParent) {
                    return this.catalogApi.getCategoryChildren(standaloneParent.id).pipe(
                      map((children) => {
                        const child = children.find(
                          (value) =>
                            this.normalizeKey(value.value) === this.normalizeKey(categoryApiValue),
                        );
                        return child
                          ? ({
                              ok: true,
                              context: {
                                genderSlug: '',
                                categorySlug: genderSlug,
                                subcategorySlug: categorySlug,
                                searchQuery,
                                searchMode: false,
                                forceSale,
                                initialCategoryFilters: {},
                                categoryFilters: { [katId]: [child.id] },
                                categoryCategoryId: katId,
                                parentCategoryValue: standaloneParent,
                                rawCategoryChildren: children,
                                categoryChildLinkPrefix: `/catalog/${genderSlug}`,
                              },
                            } satisfies RouteResolution)
                          : ({
                              ok: false,
                              reason: 'category_not_found',
                              message: 'Tražena potkategorija nije pronađena.',
                              genderSlug,
                              categorySlug,
                            } satisfies RouteResolution);
                      }),
                    );
                  }

                  if (!genderValue || !categoryValue) {
                    return of({
                      ok: false,
                      reason: 'category_not_found',
                      message: 'Tražena kategorija nije pronađena.',
                      genderSlug,
                      categorySlug,
                    } satisfies RouteResolution);
                  }

                  const buildContext = (
                    categoryValueId: string,
                    children: ApiCategoryValue[],
                  ): RouteResolution => ({
                    ok: true,
                    context: {
                      genderSlug,
                      categorySlug,
                      subcategorySlug,
                      searchQuery,
                      searchMode: false,
                      forceSale,
                      initialCategoryFilters: { [polId]: [genderValue.id] },
                      categoryFilters: { [katId]: [categoryValueId] },
                      categoryCategoryId: katId,
                      parentCategoryValue: categoryValue,
                      rawCategoryChildren: children,
                      categoryChildLinkPrefix: `/catalog/${genderSlug}/${categorySlug}`,
                    },
                  });

                  return this.catalogApi.getCategoryChildren(categoryValue.id).pipe(
                    map((children) => {
                      if (!subcategorySlug) return buildContext(categoryValue.id, children);

                      const child = children.find(
                        (value) =>
                          this.normalizeKey(value.value) ===
                          this.normalizeKey(fromSlug(subcategorySlug)),
                      );
                      return child
                        ? buildContext(child.id, children)
                        : ({
                            ok: false,
                            reason: 'category_not_found',
                            message: 'Tražena potkategorija nije pronađena.',
                            genderSlug,
                            categorySlug,
                          } satisfies RouteResolution);
                    }),
                  );
                }),
              );
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
        if (resolution.context.searchMode) {
          this.applySearchSeo(resolution.context.searchQuery);
        } else {
          this.applySeo(
            resolution.context.genderSlug,
            resolution.context.categorySlug,
            resolution.context.subcategorySlug,
          );
        }
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
    const sortKey = key as SortKey;
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

  toggleColor(valueId: string): void {
    const group = this.colorAttributeGroup();
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
    if (clamped === this.page()) return;
    this.scrollAfterPageLoad = true;
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
        if (this.scrollAfterPageLoad) {
          this.scrollAfterPageLoad = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        }
      },
      error: (e) => {
        console.error(e);
        this.response.set(null);
        this.loading.set(false);
        this.scrollAfterPageLoad = false;
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
      categoryFilters: context.categoryFilters,
      attributeFilters: {},
      minPrice: null,
      maxPrice: null,
      hasActiveDiscount: context.forceSale ? true : null,
      hasActiveStock: null,
      page: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'PRIORITY',
      sortOrder: 'DESC',
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
      path: this.currentPath(),
      noindex: true,
    });
    this.seo.clearStructuredData();
  }

  private applySeo(genderSlug: string, categorySlug: string, subcategorySlug = ''): void {
    const path = this.currentPath();
    if (!genderSlug && !categorySlug) {
      this.seo.setPage({
        title: 'Svi proizvodi | Planeta',
        description:
          'Pregled kompletne ponude uz filtere po brendu, veličini i cijeni u Planeta webshopu.',
        path,
        ogType: 'website',
      });
      return;
    }

    const genderLabel = genderSlug ? toLabel(fromSlug(genderSlug)) : 'Proizvodi';
    const categoryLabel = categorySlug ? toLabel(fromSlug(categorySlug)) : '';
    const subcategoryLabel = subcategorySlug ? toLabel(fromSlug(subcategorySlug)) : '';
    const joined = [genderLabel, categoryLabel, subcategoryLabel].filter(Boolean).join(' / ');

    this.seo.setPage({
      title: `${joined} | Planeta`,
      description: `Pregled ponude za ${joined.toLowerCase()} uz filtere po veličini, brendu i cijeni.`,
      path,
      ogType: 'website',
    });
  }

  private applySearchSeo(searchQuery: string): void {
    const encoded = encodeURIComponent(searchQuery);
    const path = this.currentPath();
    this.seo.setPage({
      title: `Rezultati pretrage za "${searchQuery}" | Planeta`,
      description: `Pregled rezultata pretrage za "${searchQuery}" u Planeta webshopu.`,
      path: `${path}?search=${encoded}`,
      ogType: 'website',
      noindex: true,
    });
  }

  private applyCollectionStructuredData(): void {
    const products = this.allProducts().slice(0, 12);
    if (!products.length) {
      this.seo.clearStructuredData();
      return;
    }

    const path = this.currentPath();
    const search = this.searchTerm();
    const withQuery = search ? `${path}?search=${encodeURIComponent(search)}` : path;

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
      url: this.seo.absoluteUrl(withQuery),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: listItems,
      },
    });
  }

  private currentPath(): string {
    return this.router.url.split('?')[0] || '/catalog';
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
    if (key === 'naziv_az') return { sortBy: 'NAME', sortOrder: 'ASC' };
    if (key === 'naziv_za') return { sortBy: 'NAME', sortOrder: 'DESC' };
    if (key === 'cijena_rastuce') return { sortBy: 'PRICE', sortOrder: 'ASC' };
    if (key === 'cijena_opadajuce') return { sortBy: 'PRICE', sortOrder: 'DESC' };
    return { sortBy: 'PRIORITY', sortOrder: 'DESC' };
  }

  private backendSortToUi(sortBy: SortBy, sortOrder: SortOrder): SortKey {
    if (sortBy === 'PRICE' && sortOrder === 'ASC') return 'cijena_rastuce';
    if (sortBy === 'PRICE' && sortOrder === 'DESC') return 'cijena_opadajuce';
    if (sortBy === 'NAME' && sortOrder === 'ASC') return 'naziv_az';
    if (sortBy === 'NAME' && sortOrder === 'DESC') return 'naziv_za';
    return 'preporucujemo';
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
