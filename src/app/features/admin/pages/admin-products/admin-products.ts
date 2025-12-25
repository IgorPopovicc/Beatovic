// admin-products.ts
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
  catchError,
  of,
} from 'rxjs';

import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';
import { AdminProductCreateModal } from './admin-products-create-modal/admin-products-create-modal';
import { ProductVariant, Product } from '../../../../core/admin-api/admin-products.models';
import { environment } from '../../../../../environments/environment';

type TabKey = 'models' | 'products';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage, AdminProductCreateModal],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts {
  private readonly api = inject(AdminProductsApi);

  // Tabs
  readonly activeTab = signal<TabKey>('models');
  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.error.set(null);

    // optional: auto-refresh when switching tabs (if query >= 3)
    const q = this.query();
    if (q.length >= 3) {
      this.refresh();
    }
  }

  // Shared search
  readonly search = new FormControl<string>('', { nonNullable: true });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // MODELS (variants) - search-main
  readonly variants = signal<ProductVariant[]>([]);
  readonly totalVariants = signal<number>(0);

  // PRODUCTS - search-product
  readonly products = signal<Product[]>([]);
  readonly totalProducts = signal<number>(0);

  // create modal (only in Products tab)
  readonly createOpen = signal(false);

  // query for UI
  readonly query = toSignal(
    this.search.valueChanges.pipe(
      startWith(this.search.value),
      map((v) => (v ?? '').trim()),
      debounceTime(350),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  readonly canSearch = computed(() => this.query().length >= 3);
  readonly hasVariantResults = computed(() => this.variants().length > 0);
  readonly hasProductResults = computed(() => this.products().length > 0);

  // Fetch based on active tab
  readonly _fetch = toSignal(
    this.search.valueChanges.pipe(
      startWith(this.search.value),
      map((v) => (v ?? '').trim()),
      debounceTime(350),
      distinctUntilChanged(),
      tap(() => this.error.set(null)),
      switchMap((q) => {
        if (q.length < 3) {
          this.loading.set(false);

          this.variants.set([]);
          this.totalVariants.set(0);

          this.products.set([]);
          this.totalProducts.set(0);

          return of(null);
        }

        this.loading.set(true);

        if (this.activeTab() === 'models') {
          return this.api.searchMain(q).pipe(
            tap((res) => {
              this.variants.set(res.foundVariants ?? []);
              this.totalVariants.set(res.totalResults ?? 0);
              this.loading.set(false);
            }),
            map(() => null),
            catchError((err) => {
              this.loading.set(false);
              this.variants.set([]);
              this.totalVariants.set(0);

              const msg =
                err?.status === 401 || err?.status === 403
                  ? 'Nemate dozvolu (provjeri admin token / role).'
                  : 'Greška pri pretrazi. Pokušajte ponovo.';
              this.error.set(msg);

              return of(null);
            }),
          );
        }

        return this.api.searchProduct(q).pipe(
          tap((res) => {
            this.products.set(res.foundProducts ?? []);
            this.totalProducts.set(res.totalResults ?? 0);
            this.loading.set(false);
          }),
          map(() => null),
          catchError((err) => {
            this.loading.set(false);
            this.products.set([]);
            this.totalProducts.set(0);

            const msg =
              err?.status === 401 || err?.status === 403
                ? 'Nemate dozvolu (provjeri admin token / role).'
                : 'Greška pri pretrazi. Pokušajte ponovo.';
            this.error.set(msg);

            return of(null);
          }),
        );
      }),
    ),
    { initialValue: null },
  );

  // images: ONLY for models/variants
  imageUrlVariant(v: ProductVariant): string | null {
    const img = (v.images ?? []).find((x) => x.displayed) ?? (v.images ?? [])[0];
    if (!img?.url) return null;
    return `${environment.mediaProductBaseUrl}${img.url}`;
  }

  formatPrice(value: number): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Actions
  addProduct(): void {
    this.createOpen.set(true);
  }

  addModel(): void {
    // placeholder for later
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  onCreated(): void {
    this.createOpen.set(false);
    this.refresh();
  }

  refresh(): void {
    const q = this.query();
    if (q.length < 3) return;

    this.loading.set(true);
    this.error.set(null);

    if (this.activeTab() === 'models') {
      this.api.searchMain(q).pipe(
        tap((res) => {
          this.variants.set(res.foundVariants ?? []);
          this.totalVariants.set(res.totalResults ?? 0);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.variants.set([]);
          this.totalVariants.set(0);
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri pretrazi. Pokušajte ponovo.';
          this.error.set(msg);
          return of(null);
        }),
      ).subscribe();
      return;
    }

    this.api.searchProduct(q).pipe(
      tap((res) => {
        this.products.set(res.foundProducts ?? []);
        this.totalProducts.set(res.totalResults ?? 0);
        this.loading.set(false);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.products.set([]);
        this.totalProducts.set(0);
        const msg =
          err?.status === 401 || err?.status === 403
            ? 'Nemate dozvolu (provjeri admin token / role).'
            : 'Greška pri pretrazi. Pokušajte ponovo.';
        this.error.set(msg);
        return of(null);
      }),
    ).subscribe();
  }

  editVariant(_v: ProductVariant): void {}
  deleteVariant(_v: ProductVariant): void {}

  editProduct(_p: Product): void {}
  deleteProduct(_p: Product): void {}

  trackByVariantId(_: number, v: ProductVariant): string {
    return v.id;
  }

  trackByProductId(_: number, p: Product): string {
    return p.id;
  }
}
