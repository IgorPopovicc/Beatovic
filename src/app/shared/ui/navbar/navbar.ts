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
import { environment } from '../../../../environments/environment';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { Variant } from '../../../core/api/catalog.models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NgOptimizedImage, ReactiveFormsModule, DecimalPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private catalogApi = inject(CatalogApiService);
  private cart = inject(CartStore);
  private productsApi = inject(ProductsApiService);
  private navigationStartSub?: Subscription;
  private bodyScrollLocked = false;
  private bodyScrollTop = 0;

  cartCount = computed(() => this.cart.itemsCount());

  private _lastY = 0;
  private _threshold = 80;

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

  // u dropdown-u prikaz je 5 uz scroll; ovde povučemo 10 da ima smisla “Prikaži više”
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
        if (q.length < 3) {
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

  showResults = computed(() => {
    const q = this.query();
    return (
      this.searchOpen() &&
      q.length >= 3 &&
      (this.variants().length > 0 || this.loadingSearch() || !!this.searchError())
    );
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const mq = window.matchMedia('(max-width: 768px)');
      this.isMobile = mq.matches;
      mq.addEventListener?.('change', (e) => (this.isMobile = e.matches));

      this.navigationStartSub = this.router.events
        .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
        .subscribe(() => this.resetTransientUiForNavigation());
    }

    this.loadDynamicMenu();
  }

  ngOnDestroy(): void {
    this.navigationStartSub?.unsubscribe();
    this.lockBodyScroll(false);
  }

  private loadDynamicMenu() {
    const pol$ = this.catalogApi.getCategoryIdByName('POL');
    const kat$ = this.catalogApi.getCategoryIdByName('KATEGORIJA');

    forkJoin([pol$, kat$]).subscribe(([polId, katId]) => {
      if (!polId || !katId) return;

      forkJoin([
        this.catalogApi.getCategoryValues(polId),
        this.catalogApi.getCategoryValues(katId),
      ]).subscribe(([polValues, kategorije]) => {
        const normalizeMenuValue = (value: unknown): { slug: string; label: string } | null => {
          const slug = toSlug(value);
          const label = toLabel(value);
          return slug && label ? { slug, label } : null;
        };

        const categoryItems = kategorije
          .map((k) => normalizeMenuValue(k?.value))
          .filter((item): item is { slug: string; label: string } => item !== null);

        const genderItems: MenuItem[] = polValues
          .map((g) => normalizeMenuValue(g?.value))
          .filter((item): item is { slug: string; label: string } => item !== null)
          .map((gender) => ({
            label: gender.label,
            children: categoryItems.map((category) => ({
              label: category.label,
              link: `/catalog/${gender.slug}/${category.slug}`,
            })),
          }));

        const base: MenuItem[] = [
          { label: 'Početna', link: '/' },
          ...genderItems,
          { label: 'Brendovi', link: '/brands' },
        ];

        this.menu.set(base);
      });
    });
  }

  toggleSearch() {
    this.searchOpen.update((v) => !v);

    if (this.searchOpen()) {
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

  closeSub() {
    this.activeParent.set(null);
  }

  go(url: string) {
    this.closeMenu();
    this.router.navigateByUrl(url);
  }

  goToProduct(v: any) {
    const variantId = (v?.id ?? '').trim();
    if (!variantId) {
      console.warn('[Navbar] Missing variant id in search result', v);
      return;
    }

    this.router.navigate(['/product', variantId]);
    this.closeSearch();
  }

  viewAllResults() {
    const q = this.query().trim();
    if (q.length < 3) return;

    const target = this.resolveCatalogTargetFromCurrentUrl();
    this.router.navigate(target, { queryParams: { q } });
    this.closeSearch();
  }

  showMoreInDropdown() {
    // UX dugme: pošto je “Pregledaj sve” prava opcija.
    // Ako želiš stvarno da paginira, dodaću page++ i append.
  }

  // ===== UI helpers =====
  getBadge(v: any): string | null {
    const oldP = Number(v?.originalPrice ?? 0);
    const newP = Number(v?.finalPrice ?? 0);
    if (!oldP || !newP || oldP <= newP) return null;
    const pct = Math.round((1 - newP / oldP) * 100);
    return `${pct}%`;
  }

  hasDiscount(v: any): boolean {
    const oldP = Number(v?.originalPrice ?? 0);
    const newP = Number(v?.finalPrice ?? 0);
    return !!oldP && !!newP && oldP > newP;
  }

  formatPrice(v: any): number {
    const p = v?.finalPrice ?? v?.originalPrice ?? 0;
    return Number(p || 0);
  }

  pickMetaLine(v: any): string {
    const cats = v?.categories ?? [];
    const categoryValue = (c: any) => String(c?.displayValue ?? c?.value ?? '').trim();
    const brand = categoryValue(
      cats.find((c: any) => (c.categoryName ?? '').toUpperCase() === 'BREND'),
    );
    const gender = categoryValue(cats.find((c: any) => (c.categoryName ?? '').toUpperCase() === 'POL'));
    const cat = categoryValue(
      cats.find((c: any) => (c.categoryName ?? '').toUpperCase() === 'KATEGORIJA'),
    );
    const parts = [brand, cat, gender].filter(Boolean);
    return parts.length ? parts.join(' • ') : (v?.sku ?? v?.productSku ?? '');
  }

  pickImageUrl(v: any): string {
    // 1) Preferiraj mainImageName/mainImageUrl (light DTO format)
    const main = (v?.mainImageName ?? v?.mainImageUrl ?? '').trim();
    if (main) {
      return this.joinMediaUrl(main);
    }

    // 2) Fallback na images[] ako backend nekad vrati i to
    const imgs = v?.images ?? [];
    const img = imgs.find((x: any) => x.displayed) ?? imgs[0];
    const url = (img?.url ?? '').trim();
    if (url) {
      // Ako je već full URL, vrati ga
      if (/^https?:\/\//i.test(url)) return url;
      return this.joinMediaUrl(url);
    }

    // 3) Placeholder
    return 'assets/images/products/test.webp';
  }

  private joinMediaUrl(filename: string): string {
    if (/^https?:\/\//i.test(filename)) return filename;

    const base = (environment as any).mediaProductBaseUrl as string | undefined;
    if (!base) return filename; // fail-safe

    // obezbedi tačno jedan "/"
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const cleanFile = filename.startsWith('/') ? filename.slice(1) : filename;
    return `${normalizedBase}${cleanFile}`;
  }

  private resolveCatalogTargetFromCurrentUrl(): string[] {
    const path = String(this.router.url ?? '').split('?')[0];
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'catalog' && segments[1] && segments[2]) {
      return ['/catalog', segments[1], segments[2]];
    }

    return ['/catalog', 'muskarci', 'obuca'];
  }

  // ===== SCROLL / MENU =====
  @HostListener('window:scroll')
  onScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;

    const goingDown = y > this._lastY;
    const nearTop = y < this._threshold;

    if (nearTop) this._hidden.set(false);
    else this._hidden.set(goingDown);

    this._lastY = y;
  }

  toggleMenu() {
    this.mobileOpen = !this.mobileOpen;
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
      this.bodyScrollTop = window.scrollY || root.scrollTop || 0;
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
    this.mobileOpen = false;
    this.closeSub();
    this.closeSearch();
    this.lockBodyScroll(false, { restoreScroll: false });
  }
}

interface MenuItem {
  label: string;
  link?: string;
  children?: { label: string; link: string }[];
}
