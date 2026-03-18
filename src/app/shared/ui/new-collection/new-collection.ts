import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductCard } from '../product-card/product-card';
import { mapVariantToProductCard, variantLooksLikeFootwear } from '../product-card/product-card.mapper';
import { ProductCardComponent } from '../product-card/product-card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-new-collection',
  imports: [CommonModule, ProductCardComponent, RouterLink],
  templateUrl: './new-collection.html',
  styleUrl: './new-collection.scss',
})
export class NewCollection implements AfterViewInit, OnDestroy {
  private readonly productsApi = inject(ProductsApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private retryPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private sectionObserver: IntersectionObserver | null = null;
  private motionQuery: MediaQueryList | null = null;
  private desktopQuery: MediaQueryList | null = null;
  private sectionInView = false;

  @ViewChild('sectionRoot') private sectionRoot?: ElementRef<HTMLElement>;
  @ViewChild('bgVideo') private bgVideo?: ElementRef<HTMLVideoElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<ProductCard[]>([]);
  readonly shouldRenderVideo = signal(false);
  readonly fallbackBackgroundImage = 'assets/images/home/hero-slide-2-mobile.jpg';

  constructor() {
    this.loadFeaturedFootwear();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.setupViewportQueries();
    this.setupSectionObserver();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.sectionObserver?.disconnect();
    this.motionQuery?.removeEventListener?.('change', this.handleViewportSettingsChange);
    this.desktopQuery?.removeEventListener?.('change', this.handleViewportSettingsChange);
    this.bgVideo?.nativeElement.pause();
    this.shouldRenderVideo.set(false);
    this.clearRetryTimer();
  }

  ensureVideoPlayback(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.shouldRenderVideo()) return;

    const video = this.bgVideo?.nativeElement;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (!playPromise) return;

    playPromise.catch(() => {
      this.scheduleRetryPlayback();
    });
  }

  private loadFeaturedFootwear(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productsApi
      .search({
        hasActiveStock: true,
        page: 0,
        pageSize: 24,
        sortBy: 'NAME',
        sortOrder: 'ASC',
      })
      .pipe(
        tap((res) => {
          const variants = res?.variants ?? [];
          const footwear = variants.filter((v) => variantLooksLikeFootwear(v));
          const source = footwear.length >= 2 ? footwear : variants;

          const mapped = source
            .map((v, idx) => mapVariantToProductCard(v, { priority: idx === 0 }))
            .filter((p) => !!p.id)
            .slice(0, 2);
          this.products.set(mapped);
          this.loading.set(false);
        }),
        catchError((err) => {
          console.error('[NewCollection] featured products load failed', err);
          this.error.set('Trenutno ne možemo učitati izdvojene modele.');
          this.products.set([]);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  private readonly handleVisibilityChange = () => {
    if (!isPlatformBrowser(this.platformId)) return;
    if (document.visibilityState === 'visible') {
      this.refreshVideoRendering();
    }
  };

  private readonly handleViewportSettingsChange = () => {
    this.refreshVideoRendering();
  };

  private setupViewportQueries(): void {
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.desktopQuery = window.matchMedia('(min-width: 900px)');

    this.motionQuery.addEventListener?.('change', this.handleViewportSettingsChange);
    this.desktopQuery.addEventListener?.('change', this.handleViewportSettingsChange);
  }

  private setupSectionObserver(): void {
    const target = this.sectionRoot?.nativeElement;
    if (!target) return;

    if (!('IntersectionObserver' in window)) {
      this.sectionInView = true;
      this.refreshVideoRendering();
      return;
    }

    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        const active = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
        this.sectionInView = active;
        this.refreshVideoRendering();
      },
      {
        threshold: 0.1,
        rootMargin: '240px 0px',
      },
    );

    this.sectionObserver.observe(target);
  }

  private refreshVideoRendering(): void {
    if (!this.canRenderVideoBackdrop()) {
      this.shouldRenderVideo.set(false);
      this.bgVideo?.nativeElement.pause();
      this.clearRetryTimer();
      return;
    }

    if (!this.shouldRenderVideo()) {
      this.shouldRenderVideo.set(true);
      requestAnimationFrame(() => this.ensureVideoPlayback());
      return;
    }

    this.ensureVideoPlayback();
  }

  private canRenderVideoBackdrop(): boolean {
    const isDesktop = this.desktopQuery?.matches ?? false;
    const reduceMotion = this.motionQuery?.matches ?? false;
    return this.sectionInView && isDesktop && !reduceMotion;
  }

  private scheduleRetryPlayback(): void {
    this.clearRetryTimer();
    this.retryPlayTimer = setTimeout(() => this.ensureVideoPlayback(), 450);
  }

  private clearRetryTimer(): void {
    if (!this.retryPlayTimer) return;
    clearTimeout(this.retryPlayTimer);
    this.retryPlayTimer = null;
  }
}
