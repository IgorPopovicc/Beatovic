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
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';

type TabKey = 'models' | 'products';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage, AdminProductCreateModal, ConfirmDialog],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts {
  private readonly api = inject(AdminProductsApi);

  // --- Delete dialog (products only) ---
  readonly deleteOpen = signal(false);
  readonly deleteBusy = signal(false);
  readonly deleteTarget = signal<Product | null>(null);

  // Tabs
  readonly activeTab = signal<TabKey>('models');

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.error.set(null);

    // zatvori modale pri promjeni taba (sigurno ponašanje)
    this.createOpen.set(false);
    this.editOpen.set(false);
    this.editingProduct.set(null);

    const q = this.query();
    if (q.length >= 3) this.refresh();
  }

  // Shared search
  readonly search = new FormControl<string>('', { nonNullable: true });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // MODELS
  readonly variants = signal<ProductVariant[]>([]);
  readonly totalVariants = signal<number>(0);

  // PRODUCTS (API vraća Product[] direktno)
  readonly products = signal<Product[]>([]);
  readonly totalProducts = signal<number>(0);

  // CREATE modal
  readonly createOpen = signal(false);

  // EDIT modal
  readonly editOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);

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

  // fetch (reacts to search changes)
  readonly _fetch = toSignal(
    this.search.valueChanges.pipe(
      startWith(this.search.value),
      map((v) => (v ?? '').trim()),
      debounceTime(350),
      distinctUntilChanged(),
      tap(() => this.error.set(null)),
      switchMap((q: string) => {
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

              // ensure products cleared
              this.products.set([]);
              this.totalProducts.set(0);

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
          tap((list) => {
            const safe = list ?? [];
            this.products.set(safe);
            this.totalProducts.set(safe.length);

            // ensure variants cleared
            this.variants.set([]);
            this.totalVariants.set(0);

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
    this.editOpen.set(false);
    this.editingProduct.set(null);
    this.createOpen.set(true);
  }

  addModel(): void {
    // placeholder
  }

  // CREATE close
  closeCreate(): void {
    this.createOpen.set(false);
  }

  // EDIT open
  editProduct(p: Product): void {
    this.createOpen.set(false);
    this.editingProduct.set(p);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editingProduct.set(null);
  }

  // after create/update
  onCreated(): void {
    this.createOpen.set(false);
    this.refresh();
  }

  onEdited(): void {
    this.editOpen.set(false);
    this.editingProduct.set(null);
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

          this.products.set([]);
          this.totalProducts.set(0);

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
      tap((list) => {
        const safe = list ?? [];
        this.products.set(safe);
        this.totalProducts.set(safe.length);

        this.variants.set([]);
        this.totalVariants.set(0);

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

  deleteProduct(p: Product): void {
    if (this.activeTab() !== 'products') return;
    this.openDeleteProduct(p);
  }

  trackByVariantId(_: number, v: ProductVariant): string {
    return v.id;
  }

  trackByProductId(_: number, p: Product): string {
    return p.id;
  }

  openDeleteProduct(p: Product): void {
    this.deleteTarget.set(p);
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    if (this.deleteBusy()) return;
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target?.id || this.deleteBusy()) return;

    this.deleteBusy.set(true);
    this.error.set(null);

    this.api.deleteProduct(target.id).subscribe({
      next: () => {
        // Najčistije: lokalno ukloni iz liste + update counter
        const updated = this.products().filter((x) => x.id !== target.id);
        this.products.set(updated);
        this.totalProducts.set(updated.length);

        this.deleteBusy.set(false);
        this.deleteOpen.set(false);
        this.deleteTarget.set(null);

        // Ako želiš uvek server truth:
        // this.refresh();
      },
      error: (err) => {
        this.deleteBusy.set(false);

        const msg =
          err?.status === 401 || err?.status === 403
            ? 'Nemate dozvolu (provjeri admin token / role).'
            : 'Greška pri brisanju proizvoda. Pokušajte ponovo.';
        this.error.set(msg);
      },
    });
  }

}
