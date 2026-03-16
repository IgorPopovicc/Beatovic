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

  @ViewChild('bgVideo') private bgVideo?: ElementRef<HTMLVideoElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<ProductCard[]>([]);

  constructor() {
    this.loadFeaturedFootwear();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    requestAnimationFrame(() => this.ensureVideoPlayback());
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.clearRetryTimer();
  }

  ensureVideoPlayback(): void {
    if (!isPlatformBrowser(this.platformId)) return;

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
      this.ensureVideoPlayback();
    }
  };

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
