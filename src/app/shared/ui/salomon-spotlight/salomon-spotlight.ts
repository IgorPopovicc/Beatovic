import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductCard } from '../product-card/product-card';
import { mapVariantToProductCard, variantMatchesBrand } from '../product-card/product-card.mapper';
import { ProductCardComponent } from '../product-card/product-card';

@Component({
  selector: 'app-salomon-spotlight',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage, ProductCardComponent],
  templateUrl: './salomon-spotlight.html',
  styleUrl: './salomon-spotlight.scss',
})
export class SalomonSpotlight {
  private readonly productsApi = inject(ProductsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<ProductCard | null>(null);

  // Downloaded internet asset stored locally for performance; easy to swap with final brand artwork.
  readonly backgroundImage = 'assets/images/home/salomon-bg.jpg';
  readonly logoImage = 'assets/images/home/salomon-logo.svg';

  constructor() {
    this.loadFeaturedSalomon();
  }

  private loadFeaturedSalomon(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productsApi
      .search({
        searchQuery: 'salomon',
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

          // fallback if text search returns nothing
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
          const salomonFirst = variants.find((v) => variantMatchesBrand(v, 'salomon')) ?? variants[0];
          const mapped = salomonFirst ? mapVariantToProductCard(salomonFirst, { priority: false }) : null;
          this.product.set(mapped?.id ? mapped : null);
          this.loading.set(false);
        }),
        catchError((err) => {
          console.error('[SalomonSpotlight] load failed', err);
          this.error.set('Salomon sekcija trenutno nije dostupna.');
          this.product.set(null);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
