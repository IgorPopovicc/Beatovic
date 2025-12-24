import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';
import { toLabel, toSlug } from '../../../core/api/catalog-slug';
import {CartStore} from '../../../core/cart/cart.store';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private catalogApi = inject(CatalogApiService);
  private cart = inject(CartStore);

  cartCount = computed(() => this.cart.itemsCount());

  private _lastY = 0;
  private _threshold = 80;

  _hidden = signal(false);
  mobileOpen = false;

  searchOpen = signal(false);
  isMobile = false;

  @ViewChild('searchInputInline') searchInputInline?: ElementRef<HTMLInputElement>;
  @ViewChild('searchInputMobile') searchInputMobile?: ElementRef<HTMLInputElement>;

  // Dinamički menu (signal)
  menu = signal<MenuItem[]>([
    { label: 'Početna', link: '/' },
    // ostatak se puni iz API
  ]);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const mq = window.matchMedia('(max-width: 768px)');
      this.isMobile = mq.matches;
      mq.addEventListener?.('change', (e) => (this.isMobile = e.matches));
    }

    this.loadDynamicMenu();
  }

  private loadDynamicMenu() {
    const pol$ = this.catalogApi.getCategoryIdByName('POL');
    const kat$ = this.catalogApi.getCategoryIdByName('KATEGORIJA');

    forkJoin([pol$, kat$]).subscribe(([polId, katId]) => {
      if (!polId || !katId) return;

      forkJoin([this.catalogApi.getCategoryValues(polId), this.catalogApi.getCategoryValues(katId)]).subscribe(
        ([polValues, kategorije]) => {
          const genderItems: MenuItem[] = polValues.map((g) => {
            const genderSlug = toSlug(g.value);

            const children = kategorije.map((k) => {
              const categorySlug = toSlug(k.value);
              return {
                label: toLabel(k.value),
                link: `/catalog/${genderSlug}/${categorySlug}`,
              };
            });

            return {
              label: toLabel(g.value),
              children,
            };
          });

          const base: MenuItem[] = [{ label: 'Početna', link: '/' }, ...genderItems, { label: 'Brendovi', link: '/brands' }];

          this.menu.set(base);
        }
      );
    });
  }

  toggleSearch() {
    this.searchOpen.update((v) => !v);

    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        (this.isMobile ? this.searchInputMobile : this.searchInputInline)?.nativeElement.focus();
      }, 0);
    }
  }

  closeSearch() {
    this.searchOpen.set(false);
  }

  activeParent = signal<number | null>(null);

  activeTitle = computed(() => {
    const idx = this.activeParent();
    const list = this.menu();
    return idx === null ? '' : list[idx]?.label ?? '';
  });

  activeChildren = computed(() => {
    const idx = this.activeParent();
    const list = this.menu();
    return idx === null ? [] : list[idx]?.children ?? [];
  });

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

  private lockBodyScroll(lock: boolean) {
    if (typeof window === 'undefined') return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }
}

interface MenuItem {
  label: string;
  link?: string;
  children?: { label: string; link: string }[];
}
