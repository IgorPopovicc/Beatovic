import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
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
        tap((response) => {
          const featuredVariant = (response?.variants ?? []).find((variant) =>
            variantMatchesBrand(variant, this.config.brandKey),
          );
          const mapped = featuredVariant
            ? mapVariantToProductCard(featuredVariant, { priority: false })
            : null;
          this.product.set(mapped?.id ? mapped : null);
          if (!mapped) {
            this.error.set('Trenutno nema dostupnih Colmar modela.');
          }
          this.loading.set(false);
        }),
        catchError((err) => {
          const status = Number((err as { status?: unknown })?.status ?? 0);
          this.error.set(
            status >= 500
              ? `${this.config.brandName} sekcija je privremeno nedostupna.`
              : `${this.config.brandName} sekcija trenutno nije dostupna.`,
          );
          this.product.set(null);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
