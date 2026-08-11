import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
export class NewCollection {
  private readonly productsApi = inject(ProductsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<ProductCard[]>([]);
  readonly fallbackBackgroundImage = 'assets/images/home/hero-slide-2-mobile.jpg';

  constructor() {
    this.loadFeaturedFootwear();
  }

  private loadFeaturedFootwear(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productsApi
      .search({
        searchQuery: 'running',
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
          const source = footwear.length ? footwear : variants;

          const mapped = source
            .map((v, idx) => mapVariantToProductCard(v, { priority: idx === 0 }))
            .filter((p) => !!p.id)
            .slice(0, 2);
          this.products.set(mapped);
          this.loading.set(false);
        }),
        catchError((err) => {
          const status = Number((err as { status?: unknown })?.status ?? 0);
          this.error.set(
            status >= 500
              ? 'Izdvojeni modeli su privremeno nedostupni. Pokušajte ponovo kasnije.'
              : 'Trenutno ne možemo učitati izdvojene modele.',
          );
          this.products.set([]);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
