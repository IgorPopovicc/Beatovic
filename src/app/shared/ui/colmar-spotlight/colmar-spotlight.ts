import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductCard } from '../product-card/product-card';
import { mapVariantToProductCard, variantMatchesBrand } from '../product-card/product-card.mapper';
import { ProductCardComponent } from '../product-card/product-card';

type BrandSpotlightConfig = {
  brandKey: string;
  brandName: string;
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaLink: string[];
  ctaQueryParams: Record<string, string>;
  fallbackBackgroundImage: string;
};

@Component({
  selector: 'app-colmar-spotlight',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './colmar-spotlight.html',
  styleUrl: './colmar-spotlight.scss',
})
export class ColmarSpotlight {
  private readonly productsApi = inject(ProductsApiService);

  readonly config: BrandSpotlightConfig = {
    brandKey: 'colmar',
    brandName: 'Colmar',
    eyebrow: 'COLMAR PERFORMANCE',
    headline: 'Premium stil za grad i planinu',
    description:
      'Colmar kombinuje tehničke materijale i italijanski dizajn za moderne trening i lifestyle kombinacije.',
    ctaLabel: 'Pogledaj sve Colmar modele',
    ctaLink: ['/catalog', 'muskarci', 'obuca'],
    ctaQueryParams: { q: 'colmar' },
    fallbackBackgroundImage: 'assets/images/home/hero-slide-2.jpg',
  };

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<ProductCard | null>(null);
  readonly backgroundImage = computed(
    () => this.product()?.image.desktop || this.config.fallbackBackgroundImage,
  );

  constructor() {
    this.loadFeaturedBrand();
  }

  private loadFeaturedBrand(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productsApi
      .search({
        searchQuery: this.config.brandKey,
        hasActiveStock: true,
        page: 0,
        pageSize: 8,
        sortBy: 'NAME',
        sortOrder: 'ASC',
      })
      .pipe(
        switchMap((res) => {
          const initial = res?.variants ?? [];
          if (initial.length > 0) return of(initial);

          // Fallback if text search returns nothing.
          return this.productsApi.search({ hasActiveStock: true, page: 0, pageSize: 8 }).pipe(
            tap((fallbackRes) => {
              if (!fallbackRes?.variants?.length) {
                this.error.set('Trenutno nema dostupnih modela za ovaj blok.');
              }
            }),
            switchMap((fallbackRes) => of(fallbackRes?.variants ?? [])),
          );
        }),
        tap((variants) => {
          const featuredVariant =
            variants.find((v) => variantMatchesBrand(v, this.config.brandKey)) ?? variants[0];
          const mapped = featuredVariant
            ? mapVariantToProductCard(featuredVariant, { priority: false })
            : null;
          this.product.set(mapped?.id ? mapped : null);
          this.loading.set(false);
        }),
        catchError((err) => {
          console.error('[ColmarSpotlight] load failed', err);
          this.error.set(`${this.config.brandName} sekcija trenutno nije dostupna.`);
          this.product.set(null);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
