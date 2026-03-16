import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { ProductsApiService } from '../../../core/api/products-api.service';
import { ProductCard } from '../product-card/product-card';
import { mapVariantToProductCard } from '../product-card/product-card.mapper';
import { ProductCardComponent } from '../product-card/product-card';

@Component({
  selector: 'app-discount-slider',
  imports: [CommonModule, ProductCardComponent, RouterLink],
  templateUrl: './discount-slider.html',
  styleUrl: './discount-slider.scss',
})
export class DiscountSlider {
  private readonly productsApi = inject(ProductsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<ProductCard[]>([]);

  readonly visibleProducts = computed(() => this.products().slice(0, 6));

  constructor() {
    this.loadDiscountedProducts();
  }

  private loadDiscountedProducts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.productsApi
      .search({
        hasActiveDiscount: true,
        hasActiveStock: true,
        page: 0,
        pageSize: 18,
        sortBy: 'NAME',
        sortOrder: 'ASC',
      })
      .pipe(
        tap((res) => {
          const seen = new Set<string>();
          const mapped = (res?.variants ?? [])
            .map((v, idx) => mapVariantToProductCard(v, { priority: idx === 0 }))
            .filter((p) => {
              if (!p.id || seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });

          this.products.set(mapped);
          this.loading.set(false);
        }),
        catchError((err) => {
          console.error('[DiscountSlider] discounted products load failed', err);
          this.error.set('Trenutno ne možemo učitati proizvode na popustu.');
          this.products.set([]);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }
}
