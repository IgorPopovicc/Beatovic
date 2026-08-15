import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';
import { CategoryVisibilityService } from '../../../core/api/category-visibility.service';
import { toLabel, toSlug } from '../../../core/api/catalog-slug';
import { CartStore } from '../../../core/cart/cart.store';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ApiCategoryValue, Variant } from '../../../core/api/catalog.models';
import { runtimeMediaUrl } from '../../../core/config/runtime-config.service';
import { currencyDisplayLabel } from '../../utils/currency';
import { ProductImageComponent } from '../product-image/product-image';

type VariantCategory = NonNullable<Variant['categories']>[number];

const GENDER_NAVIGATION_ORDER = ['MUSKARCI', 'ZENE', 'DECA', 'BEBE'] as const;
const GENDER_NAVIGATION_RANK = new Map<string, number>(
  GENDER_NAVIGATION_ORDER.map((value, index) => [value, index]),
);

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgOptimizedImage,
    ReactiveFormsModule,
    DecimalPipe,
    ProductImageComponent,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private static readonly NAV_HEIGHT_PX = 98;
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private catalogApi = inject(CatalogApiService);
  private categoryVisibility = inject(CategoryVisibilityService);
  private cart = inject(CartStore);
  private productsApi = inject(ProductsApiService);
  private navigationStartSub?: Subscription;
  private mobileMediaQuery?: MediaQueryList;
  private readonly onMobileMediaChange = (event: MediaQueryListEvent): void => {
    this.isMobile = event.matches;
  };
  private bodyScrollLocked = false;
  private bodyScrollTop = 0;
  private lastParentTrigger?: HTMLElement;

  cartCount = computed(() => this.cart.itemsCount());

  private lastScrollY = 0;
  private readonly hideAfterScrollRatio = 0.2;
  private readonly directionDeltaPx = 8;
  private readonly minScrollableForAutoHidePx = Navbar.NAV_HEIGHT_PX * 2;

  _hidden = signal(false);
  mobileOpen = false;

  searchOpen = signal(false);
  isMobile = false;

  @ViewChild('searchInputInline') searchInputInline?: ElementRef<HTMLInputElement>;
  @ViewChild('searchInputMobile') searchInputMobile?: ElementRef<HTMLInputElement>;
  @ViewChild('menuTrigger') menuTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('drawer') drawer?: ElementRef<HTMLElement>;
  @ViewChild('drawerClose') drawerClose?: ElementRef<HTMLButtonElement>;
  @ViewChild('submenuBack') submenuBack?: ElementRef<HTMLButtonElement>;

  // ===== MENU =====
  menu = signal<MenuItem[]>([{ label: 'Početna', link: '/' }]);
  menuLoading = signal(true);
  activeParent = signal<number | null>(null);

  activeTitle = computed(() => {
    const idx = this.activeParent();
    const list = this.menu();
    return idx === null ? '' : (list[idx]?.label ?? '');
  });

  activeChildren = computed(() => {
    const idx = this.activeParent();
    const list = this.menu();
    return idx === null ? [] : (list[idx]?.children ?? []);
  });

  // ===== SEARCH (TYPEAHEAD) =====
  readonly search = new FormControl<string>('', { nonNullable: true });

  loadingSearch = signal(false);
  searchError = signal<string | null>(null);

  private readonly minCharsForSuggestions = 3;
  // U dropdownu prikazujemo ograničen broj, a puna lista ide kroz "Pogledaj sve".
  private readonly _pageSize = 10;

  variants = signal<Variant[]>([]);
  totalVariants = signal<number>(0);

  readonly query = toSignal(
    this.search.valueChanges.pipe(
      startWith(this.search.value),
      map((v) => (v ?? '').trim()),
      debounceTime(250),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly _fetch = toSignal(
    this.search.valueChanges.pipe(
      startWith(this.search.value),
      map((v) => (v ?? '').trim()),
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => this.searchError.set(null)),
      switchMap((q) => {
        if (q.length < this.minCharsForSuggestions) {
          this.loadingSearch.set(false);
          this.variants.set([]);
          this.totalVariants.set(0);
          return of(null);
        }

        this.loadingSearch.set(true);

        return this.productsApi
          .search({
            searchQuery: q,
            page: 0,
            pageSize: this._pageSize,
            sortBy: 'NAME',
            sortOrder: 'ASC',
          })
          .pipe(
            tap((res) => {
              const items = (res.variants ?? []) as Variant[];
              this.variants.set(items);
              this.totalVariants.set(res.totalResults ?? items.length);
              this.loadingSearch.set(false);
            }),
            map(() => null),
            catchError((err) => {
              this.loadingSearch.set(false);
              this.variants.set([]);
              this.totalVariants.set(0);

              const msg = 'Greška pri pretrazi. Pokušajte ponovo.';
              this.searchError.set(msg);
              return of(null);
            }),
          );
      }),
    ),
    { initialValue: null },
  );

  shownVariants = computed(() => this.variants());

  canViewAll = computed(() => this.query().length > 0);

  needsMoreChars = computed(() => {
    const q = this.query();
    if (!q) return false;
    return q.length < this.minCharsForSuggestions;
  });

  resultCountLabel = computed(() => {
    const total = this.totalVariants();
    if (total <= 0) return '0 rezultata';
    if (total === 1) return '1 rezultat';
    return `${total} rezultata`;
  });

  showResults = computed(() => {
    return this.searchOpen() && this.query().length > 0;
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.mobileMediaQuery = window.matchMedia('(max-width: 768px)');
      this.isMobile = this.mobileMediaQuery.matches;
      this.mobileMediaQuery.addEventListener?.('change', this.onMobileMediaChange);
      this.lastScrollY = this.currentScrollY();

      this.navigationStartSub = this.router.events
        .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
        .subscribe(() => this.resetTransientUiForNavigation());
    }

    this.loadDynamicMenu();
  }

  ngOnDestroy(): void {
    this.navigationStartSub?.unsubscribe();
    this.mobileMediaQuery?.removeEventListener?.('change', this.onMobileMediaChange);
    this.lockBodyScroll(false);
  }

  private loadDynamicMenu() {
    const pol$ = this.catalogApi.getCategoryIdByName('POL');
    const kat$ = this.catalogApi.getCategoryIdByName('KATEGORIJA');

    forkJoin([pol$, kat$]).subscribe({
      next: ([polId, katId]) => {
        if (!polId || !katId) {
          this.setFallbackMenu();
          return;
        }

        forkJoin([
          this.catalogApi.getCategoryValues(polId, { onlyRoot: true }),
          this.catalogApi.getCategoryValues(katId, { onlyRoot: true }),
        ]).subscribe({
          next: ([polValues, rootCategories]) => {
            const toMenuValue = (
              item: ApiCategoryValue,
            ): {
              id: string;
              value: string;
              slug: string;
              label: string;
              hasChildren: boolean;
            } | null => {
              const slug = toSlug(item.value);
              const label = String(item.displayValue ?? '').trim() || toLabel(item.value);
              return slug && label
                ? {
                    id: item.id,
                    value: item.value,
                    slug,
                    label,
                    hasChildren: item.hasChildren === true,
                  }
                : null;
            };

            const buildMenu = (categorySource: ApiCategoryValue[]) => {
              const categoryItems = categorySource
                .map(toMenuValue)
                .filter(
                  (item): item is NonNullable<ReturnType<typeof toMenuValue>> => item !== null,
                );

              const primaryCategoryValues = new Set(['OBUCA', 'ODECA', 'AKSESOARI']);
              const primaryCategories = categoryItems.filter((item) =>
                primaryCategoryValues.has(this.normalizeMenuValue(item.value)),
              );

              const genderItems: MenuItem[] = polValues
                .map(toMenuValue)
                .filter(
                  (item): item is NonNullable<ReturnType<typeof toMenuValue>> => item !== null,
                )
                .filter((item) => GENDER_NAVIGATION_RANK.has(this.normalizeMenuValue(item.value)))
                .sort(
                  (a, b) =>
                    (GENDER_NAVIGATION_RANK.get(this.normalizeMenuValue(a.value)) ??
                      Number.MAX_SAFE_INTEGER) -
                    (GENDER_NAVIGATION_RANK.get(this.normalizeMenuValue(b.value)) ??
                      Number.MAX_SAFE_INTEGER),
                )
                .map((gender, index) => ({
                  label: gender.label,
                  dividerBefore: index === 0,
                  children: primaryCategories.map((category) => ({
                    key: `${gender.id}:${category.id}`,
                    id: category.id,
                    value: category.value,
                    label: category.label,
                    link: `/catalog/${gender.slug}/${category.slug}`,
                    childLinkPrefix: `/catalog/${gender.slug}/${category.slug}`,
                    hasChildren: category.hasChildren,
                    categoryId: katId,
                    genderCategoryId: polId,
                    genderValueId: gender.id,
                  })),
                }));

              const toys = categoryItems.find(
                (item) => this.normalizeMenuValue(item.value) === 'IGRACKE_I_OSTALO',
              );
              const remaining = categoryItems.filter(
                (item) =>
                  !primaryCategoryValues.has(this.normalizeMenuValue(item.value)) &&
                  this.normalizeMenuValue(item.value) !== 'IGRACKE_I_OSTALO',
              );

              const base: MenuItem[] = [
                { label: 'Početna', link: '/' },
                ...genderItems,
                ...(toys
                  ? [
                      {
                        label: toys.label,
                        dividerBefore: true,
                        children: [
                          {
                            key: `all:${toys.id}`,
                            id: toys.id,
                            value: toys.value,
                            label: `Sve: ${toys.label}`,
                            link: `/catalog/${toys.slug}`,
                            childLinkPrefix: `/catalog/${toys.slug}`,
                            hasChildren: toys.hasChildren,
                            categoryId: katId,
                          },
                        ],
                      },
                    ]
                  : []),
                ...(remaining.length
                  ? [
                      {
                        label: 'Ostalo',
                        dividerBefore: !toys,
                        children: remaining.map((category) => ({
                          key: `all:${category.id}`,
                          id: category.id,
                          value: category.value,
                          label: category.label,
                          link: `/catalog/${category.slug}`,
                          childLinkPrefix: `/catalog/${category.slug}`,
                          hasChildren: category.hasChildren,
                          categoryId: katId,
                        })),
                      },
                    ]
                  : []),
                { label: 'Brendovi', link: '/brands', dividerBefore: true },
              ];

              this.menu.set(base);
              this.menuLoading.set(false);
            };

            buildMenu(rootCategories);
          },
          error: () => this.setFallbackMenu(),
        });
      },
      error: () => this.setFallbackMenu(),
    });
  }

  private setFallbackMenu(): void {
    this.activeParent.set(null);
    this.menuLoading.set(false);
    this.menu.set([
      { label: 'Početna', link: '/' },
      { label: 'Brendovi', link: '/brands', dividerBefore: true },
    ]);
  }

  toggleSearch() {
    this.searchOpen.update((v) => !v);

    if (this.searchOpen()) {
      this._hidden.set(false);
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          (this.isMobile ? this.searchInputMobile : this.searchInputInline)?.nativeElement.focus();
        }, 0);
      }
    } else {
      this.closeSearch();
    }
  }

  closeSearch() {
    this.searchOpen.set(false);
    this.searchError.set(null);
  }

  openSub(i: number, trigger?: EventTarget | null) {
    if (!this.menu()[i]?.children) return;

    this.lastParentTrigger = trigger instanceof HTMLElement ? trigger : undefined;
    this.activeParent.set(i);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.submenuBack?.nativeElement.focus(), 0);
    }
  }

  toggleCategoryChildren(child: MenuChild): void {
    if (!child.hasChildren || child.loading) return;

    if (child.descendants !== undefined) {
      this.updateMenuChild(child.key, { expanded: !child.expanded });
      return;
    }

    this.updateMenuChild(child.key, {
      loading: true,
      expanded: true,
      error: false,
      empty: false,
    });
    this.categoryVisibility
      .getVisibleChildren({
        categoryId: child.categoryId,
        parentCategoryValueId: child.id,
        genderCategoryId: child.genderCategoryId,
        genderValueId: child.genderValueId,
      })
      .subscribe({
        next: (values) => {
          const descendants = values
            .map((value) => {
              const slug = toSlug(value.value);
              const label = String(value.displayValue ?? '').trim() || toLabel(value.value);
              return slug && label ? { label, link: `${child.childLinkPrefix}/${slug}` } : null;
            })
            .filter((value): value is { label: string; link: string } => value !== null);

          this.updateMenuChild(child.key, {
            loading: false,
            expanded: true,
            descendants,
            empty: descendants.length === 0,
            error: false,
          });
        },
        error: () => {
          // Keep descendants unset so a temporary API failure can be retried.
          this.updateMenuChild(child.key, {
            loading: false,
            expanded: false,
            empty: false,
            error: true,
          });
        },
      });
  }

  private updateMenuChild(key: string, patch: Partial<MenuChild>): void {
    this.menu.update((items) =>
      items.map((item) => ({
        ...item,
        children: item.children?.map((child) =>
          child.key === key ? { ...child, ...patch } : child,
        ),
      })),
    );
  }

  private normalizeMenuValue(value: unknown): string {
    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toUpperCase();
  }

  closeSub() {
    const returnTarget = this.lastParentTrigger;
    this.activeParent.set(null);
    if (returnTarget && isPlatformBrowser(this.platformId)) {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  go(url: string) {
    this.closeMenu();
    this.router.navigateByUrl(url);
  }

  goToProduct(v: Variant) {
    const variantId = String(v.id ?? '').trim();
    if (!variantId) {
      console.warn('[Navbar] Missing variant id in search result', v);
      return;
    }

    this.router.navigate(['/product', variantId]);
    this.closeSearch();
  }

  viewAllResults() {
    const q = String(this.search.value ?? '').trim();
    if (!q) return;

    this.router.navigate(['/products'], { queryParams: { search: q } });
    this.closeSearch();
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.viewAllResults();
  }

  // ===== UI helpers =====
  getBadge(v: Variant): string | null {
    const oldP = Number(v.originalPrice ?? 0);
    const newP = Number(v.finalPrice ?? 0);
    if (!oldP || !newP || oldP <= newP) return null;
    const pct = Math.round((1 - newP / oldP) * 100);
    return `${pct}%`;
  }

  hasDiscount(v: Variant): boolean {
    const oldP = Number(v.originalPrice ?? 0);
    const newP = Number(v.finalPrice ?? 0);
    return !!oldP && !!newP && oldP > newP;
  }

  formatPrice(v: Variant): number {
    const p = v.finalPrice ?? v.originalPrice ?? 0;
    return Number(p || 0);
  }

  currencyLabel(currency?: unknown): string {
    return currencyDisplayLabel(currency);
  }

  pickMetaLine(v: Variant): string {
    const cats = v.categories ?? [];
    const categoryValue = (c?: VariantCategory) => String(c?.displayValue ?? c?.value ?? '').trim();
    const brand = categoryValue(cats.find((c) => (c.categoryName ?? '').toUpperCase() === 'BREND'));
    const gender = categoryValue(cats.find((c) => (c.categoryName ?? '').toUpperCase() === 'POL'));
    const cat = categoryValue(
      cats.find((c) => (c.categoryName ?? '').toUpperCase() === 'KATEGORIJA'),
    );
    const parts = [brand, cat, gender].filter(Boolean);
    return parts.length ? parts.join(' • ') : (v.displaySku ?? v.sku ?? v.productSku ?? '');
  }

  pickImageUrl(v: Variant): string {
    const imgs = v.images ?? [];
    const img = imgs.find((candidate) => candidate.displayed) ?? imgs[0];
    const candidates = [
      v.mainImageWebUrl,
      img?.webUrl,
      v.mainImageUrl,
      img?.url,
      img?.originalUrl,
      v.mainImageName,
    ];

    for (const candidate of candidates) {
      const resolved = runtimeMediaUrl(candidate);
      if (resolved) return resolved;
    }

    return '';
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!isPlatformBrowser(this.platformId)) return;

    const y = this.currentScrollY();

    if (this.mobileOpen || this.searchOpen()) {
      this._hidden.set(false);
      this.lastScrollY = y;
      return;
    }

    const maxScroll = this.maxScrollableY();
    if (maxScroll < this.minScrollableForAutoHidePx) {
      this._hidden.set(false);
      this.lastScrollY = y;
      return;
    }

    const hideStartY = Math.floor(maxScroll * this.hideAfterScrollRatio);
    if (y <= hideStartY) {
      this._hidden.set(false);
      this.lastScrollY = y;
      return;
    }

    const delta = y - this.lastScrollY;
    if (Math.abs(delta) < this.directionDeltaPx) return;

    this._hidden.set(delta > 0);
    this.lastScrollY = y;
  }

  toggleMenu() {
    if (this.mobileOpen) {
      this.closeMenu();
      return;
    }

    this.closeSearch();
    this.mobileOpen = true;
    this._hidden.set(false);
    this.lockBodyScroll(true);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.drawerClose?.nativeElement.focus(), 0);
    }
  }

  closeMenu(restoreFocus = true) {
    const wasOpen = this.mobileOpen;
    this.mobileOpen = false;
    this.lockBodyScroll(false);
    this.activeParent.set(null);
    this.lastParentTrigger = undefined;

    if (wasOpen && restoreFocus && isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.menuTrigger?.nativeElement.focus(), 0);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.mobileOpen) {
        event.preventDefault();
        this.closeMenu();
      }
      this.closeSearch();
      return;
    }

    if (event.key !== 'Tab' || !this.mobileOpen || !this.drawer) return;

    const focusable = Array.from(
      this.drawer.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.closest('[inert]'));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && (current === first || !this.drawer.nativeElement.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !this.drawer.nativeElement.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent) {
    if (!this.searchOpen()) return;

    const target = ev.target as HTMLElement | null;
    if (!target) return;

    const inSearch =
      !!target.closest('.search') ||
      !!target.closest('.search-mobile') ||
      !!target.closest('.search-results');

    if (!inSearch) this.closeSearch();
  }

  private lockBodyScroll(lock: boolean, options?: { restoreScroll?: boolean }) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (lock === this.bodyScrollLocked) return;

    const body = document.body;
    const root = document.documentElement;

    if (lock) {
      this.bodyScrollTop = this.currentScrollY();
      body.style.position = 'fixed';
      body.style.top = `-${this.bodyScrollTop}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      this.bodyScrollLocked = true;
      return;
    }

    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    root.style.overflow = '';
    this.bodyScrollLocked = false;

    if (options?.restoreScroll !== false) {
      window.scrollTo({
        top: this.bodyScrollTop,
        left: 0,
        behavior: 'auto',
      });
    }
  }

  private resetTransientUiForNavigation(): void {
    this._hidden.set(false);
    this.mobileOpen = false;
    this.activeParent.set(null);
    this.lastParentTrigger = undefined;
    this.closeSearch();
    this.lockBodyScroll(false, { restoreScroll: false });
  }

  private currentScrollY(): number {
    const scroller = document.scrollingElement as HTMLElement | null;
    if (scroller) return scroller.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  private maxScrollableY(): number {
    const scroller = document.scrollingElement as HTMLElement | null;
    if (scroller) {
      return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    }

    const root = document.documentElement;
    return Math.max(0, root.scrollHeight - root.clientHeight);
  }
}

interface MenuItem {
  label: string;
  link?: string;
  dividerBefore?: boolean;
  children?: MenuChild[];
}

interface MenuChild {
  key: string;
  id: string;
  value: string;
  label: string;
  link: string;
  childLinkPrefix: string;
  hasChildren: boolean;
  categoryId: string;
  genderCategoryId?: string;
  genderValueId?: string;
  loading?: boolean;
  expanded?: boolean;
  error?: boolean;
  empty?: boolean;
  descendants?: { label: string; link: string }[];
}
