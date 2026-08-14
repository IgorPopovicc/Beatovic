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
import { NavigationStart, Router, RouterLink } from '@angular/router';
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
import { toLabel, toSlug } from '../../../core/api/catalog-slug';
import { CartStore } from '../../../core/cart/cart.store';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ApiCategoryValue, Variant } from '../../../core/api/catalog.models';
import { runtimeMediaUrl } from '../../../core/config/runtime-config.service';
import { currencyDisplayLabel } from '../../utils/currency';

type VariantCategory = NonNullable<Variant['categories']>[number];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage, ReactiveFormsModule, DecimalPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private static readonly NAV_HEIGHT_PX = 98;
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private catalogApi = inject(CatalogApiService);
  private cart = inject(CartStore);
  private productsApi = inject(ProductsApiService);
  private navigationStartSub?: Subscription;
  private mobileMediaQuery?: MediaQueryList;
  private readonly onMobileMediaChange = (event: MediaQueryListEvent): void => {
    this.isMobile = event.matches;
  };
  private bodyScrollLocked = false;
  private bodyScrollTop = 0;

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

  // ===== MENU =====
  menu = signal<MenuItem[]>([{ label: 'Početna', link: '/' }]);
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
        ): { id: string; value: string; slug: string; label: string; hasChildren: boolean } | null => {
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
            .filter((item): item is NonNullable<ReturnType<typeof toMenuValue>> => item !== null);

          const primaryCategoryValues = new Set(['OBUCA', 'ODECA', 'AKSESOARI']);
          const primaryCategories = categoryItems.filter((item) =>
            primaryCategoryValues.has(this.normalizeMenuValue(item.value)),
          );

          const genderValues = new Set(['MUSKARCI', 'ZENE', 'DECA', 'BEBE']);

          const genderItems: MenuItem[] = polValues
            .map(toMenuValue)
            .filter((item): item is NonNullable<ReturnType<typeof toMenuValue>> => item !== null)
            .filter((item) => genderValues.has(this.normalizeMenuValue(item.value)))
            .map((gender) => ({
              label: gender.label,
              children: primaryCategories.map((category) => ({
                id: category.id,
                value: category.value,
                label: category.label,
                link: `/catalog/${gender.slug}/${category.slug}`,
                childLinkPrefix: `/catalog/${gender.slug}/${category.slug}`,
                hasChildren: category.hasChildren,
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
                    children: [
                      {
                        id: toys.id,
                        value: toys.value,
                        label: `Sve: ${toys.label}`,
                        link: `/catalog/${toys.slug}`,
                        childLinkPrefix: `/catalog/${toys.slug}`,
                        hasChildren: toys.hasChildren,
                      },
                    ],
                  },
                ]
              : []),
            ...(remaining.length
              ? [
                  {
                    label: 'Ostalo',
                    children: remaining.map((category) => ({
                      id: category.id,
                      value: category.value,
                      label: category.label,
                      link: `/catalog/${category.slug}`,
                      childLinkPrefix: `/catalog/${category.slug}`,
                      hasChildren: category.hasChildren,
                    })),
                  },
                ]
              : []),
            { label: 'Brendovi', link: '/brands' },
          ];

          this.menu.set(base);
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
    this.menu.set([
      { label: 'Početna', link: '/' },
      { label: 'Brendovi', link: '/brands' },
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

  openSub(i: number) {
    if (this.menu()[i]?.children) this.activeParent.set(i);
  }

  toggleCategoryChildren(child: MenuChild): void {
    if (!child.hasChildren || child.loading) return;

    if (child.descendants) {
      this.updateMenuChild(child.id, { expanded: !child.expanded });
      return;
    }

    this.updateMenuChild(child.id, { loading: true, expanded: true, error: false });
    this.catalogApi.getCategoryChildren(child.id).subscribe({
      next: (values) => {
        const descendants = values
          .map((value) => {
            const slug = toSlug(value.value);
            const label = String(value.displayValue ?? '').trim() || toLabel(value.value);
            return slug && label
              ? { label, link: `${child.childLinkPrefix}/${slug}` }
              : null;
          })
          .filter((value): value is { label: string; link: string } => value !== null);

        this.updateMenuChild(child.id, {
          loading: false,
          expanded: descendants.length > 0,
          descendants,
          error: descendants.length === 0,
        });
      },
      error: () => {
        // Keep descendants unset so a temporary API/auth failure can be retried.
        this.updateMenuChild(child.id, { loading: false, expanded: false, error: true });
      },
    });
  }

  private updateMenuChild(id: string, patch: Partial<MenuChild>): void {
    this.menu.update((items) =>
      items.map((item) => ({
        ...item,
        children: item.children?.map((child) =>
          child.id === id ? { ...child, ...patch } : child,
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
    this.activeParent.set(null);
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
    // Search results use web-optimized images when the backend provides them.
    const main = (v.mainImageWebUrl ?? v.mainImageUrl ?? v.mainImageName ?? '').trim();
    if (main) {
      return runtimeMediaUrl(main);
    }

    // Fall back to the backend image collection when the main image fields are absent.
    const imgs = v.images ?? [];
    const img = imgs.find((candidate) => candidate.displayed) ?? imgs[0];
    const url = (img?.webUrl ?? img?.url ?? img?.originalUrl ?? '').trim();
    if (url) {
      return runtimeMediaUrl(url);
    }

    // A real missing image gets one generic placeholder, never a fake product image.
    return 'assets/images/products/no-image.svg';
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
    this.mobileOpen = !this.mobileOpen;
    if (this.mobileOpen) {
      this._hidden.set(false);
    }
    this.lockBodyScroll(this.mobileOpen);
  }

  closeMenu() {
    this.mobileOpen = false;
    this.lockBodyScroll(false);
    this.closeSub();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeMenu();
    this.closeSearch();
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
    this.closeSub();
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
  children?: MenuChild[];
}

interface MenuChild {
  id: string;
  value: string;
  label: string;
  link: string;
  childLinkPrefix: string;
  hasChildren: boolean;
  loading?: boolean;
  expanded?: boolean;
  error?: boolean;
  descendants?: { label: string; link: string }[];
}
