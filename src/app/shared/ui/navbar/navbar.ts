import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    NgOptimizedImage
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private _lastY = 0;
  private _threshold = 80;
  private router = inject(Router);
  _hidden = signal(false);
  mobileOpen = false;

  searchOpen = signal(false);
  isMobile = false;

  @ViewChild('searchInputInline') searchInputInline?: ElementRef<HTMLInputElement>;
  @ViewChild('searchInputMobile') searchInputMobile?: ElementRef<HTMLInputElement>;

  menu: MenuItem[] = [
    { label: 'Home', link: '/' },
    {
      label: 'Shop',
      children: [
        { label: 'New In', link: '/catalog/new' },
        { label: 'Bags', link: '/catalog/bags' },
        { label: 'Accessories', link: '/catalog/accessories' },
        { label: 'Sale', link: '/catalog/sale' },
      ]
    },
    { label: 'About', link: '/about' },
    { label: 'Account', link: '/account' }
  ];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const mq = window.matchMedia('(max-width: 768px)');
      this.isMobile = mq.matches;
      mq.addEventListener?.('change', e => this.isMobile = e.matches);
    }
  }

  toggleSearch() {
    this.searchOpen.update(v => !v);
    // fokusiraj odgovarajući input nakon sljedećeg tick-a
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        (this.isMobile ? this.searchInputMobile : this.searchInputInline)?.nativeElement.focus();
      }, 0);
    }
  }
  closeSearch() { this.searchOpen.set(false); }

  activeParent = signal<number | null>(null);

  activeTitle = computed(() => {
    const idx = this.activeParent();
    return idx === null ? '' : this.menu[idx].label;
  });

  activeChildren = computed(() => {
    const idx = this.activeParent();
    return idx === null ? [] : (this.menu[idx].children ?? []);
  });

  openSub(i: number) {
    if (this.menu[i]?.children) this.activeParent.set(i);
  }
  closeSub() {
    this.activeParent.set(null);
  }

  // Ako želiš programatsku navigaciju za stavke bez linka:
  go(url: string) {
    this.closeMenu();
    this.router.navigateByUrl(url).then(r => console.log(r));
  }

  @HostListener('window:scroll')
  onScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;

    // sakrij kad idemo naniže preko praga; prikaži kad idemo naviše ili smo blizu vrha
    const goingDown = y > this._lastY;
    const nearTop = y < this._threshold;

    if (nearTop) {
      this._hidden.set(false);
    } else {
      this._hidden.set(goingDown);
    }
    this._lastY = y;
  }

  toggleMenu() {
    this.mobileOpen = !this.mobileOpen;
    this.lockBodyScroll(this.mobileOpen);
  }

  closeMenu() {
    this.mobileOpen = false;
    this.lockBodyScroll(false);
  }

  @HostListener('document:keydown.escape')
  onEsc() { this.closeMenu(); }

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
