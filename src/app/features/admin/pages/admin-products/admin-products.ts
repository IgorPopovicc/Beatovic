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
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { AdminVariantCreateModal } from './admin-variant-create-modal/admin-variant-create-modal';
import { AdminVariantUpdateModal } from './admin-variant-update-modal/admin-variant-update-modal';

type TabKey = 'models' | 'products';

type DeleteType = 'product' | 'variant';

type DeleteState =
  | { type: DeleteType; id: string; name: string }
  | null;

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgOptimizedImage,
    AdminProductCreateModal,
    ConfirmDialog,
    AdminVariantCreateModal,
    AdminVariantUpdateModal,
  ],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts {
  private readonly api = inject(AdminProductsApi);

  readonly activeTab = signal<TabKey>('models');

  readonly search = new FormControl<string>('', { nonNullable: true });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly variants = signal<ProductVariant[]>([]);
  readonly totalVariants = signal<number>(0);

  readonly products = signal<Product[]>([]);
  readonly totalProducts = signal<number>(0);

  readonly createOpen = signal(false);

  readonly editOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);

  readonly variantCreateOpen = signal(false);

  readonly updateOpen = signal(false);
  readonly updateVariantId = signal<string | null>(null);

  // ===== DELETE (shared for product + variant) =====
  readonly deleteOpen = signal(false);
  readonly deleteBusy = signal(false);
  readonly deleteState = signal<DeleteState>(null);

  readonly deleteTitle = computed(() =>
    this.deleteState()?.type === 'variant' ? 'Brisanje modela' : 'Brisanje proizvoda',
  );

  readonly deleteMessage = computed(() => {
    const st = this.deleteState();
    if (!st) return '';
    return st.type === 'variant'
      ? `Da li želite da obrišete model “${st.name}”?`
      : `Da li želite da obrišete proizvod “${st.name}”?`;
  });

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

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.error.set(null);

    this.createOpen.set(false);
    this.editOpen.set(false);
    this.editingProduct.set(null);

    this.variantCreateOpen.set(false);

    this.closeUpdate();

    // zatvori delete modal ako je otvoren (da ne ostane "staro" stanje)
    this.cancelDelete();

    const q = this.query();
    if (q.length >= 3) this.refresh();
  }

  onVariantUpdated(_variant: ProductVariant): void {
    this.closeUpdate();
    this.refresh();
  }

  openUpdate(variantId: string): void {
    this.updateVariantId.set(variantId);
    this.updateOpen.set(true);
  }

  closeUpdate(): void {
    this.updateOpen.set(false);
    this.updateVariantId.set(null);
  }

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

  addProduct(): void {
    this.editOpen.set(false);
    this.editingProduct.set(null);
    this.createOpen.set(true);
  }

  addModel(): void {
    if (this.activeTab() !== 'models') return;

    this.createOpen.set(false);
    this.editOpen.set(false);
    this.editingProduct.set(null);

    this.variantCreateOpen.set(true);
  }

  closeVariantCreate(): void {
    this.variantCreateOpen.set(false);
  }

  onVariantCreated(): void {
    this.variantCreateOpen.set(false);
    this.refresh();
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  editProduct(p: Product): void {
    this.createOpen.set(false);
    this.editingProduct.set(p);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editingProduct.set(null);
  }

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
      this.api
        .searchMain(q)
        .pipe(
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
        )
        .subscribe();

      return;
    }

    this.api
      .searchProduct(q)
      .pipe(
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
      )
      .subscribe();
  }

  editVariant(v: ProductVariant): void {
    this.openUpdate(v.id);
  }

  // ===== TrackBy =====
  trackByVariantId(_: number, v: ProductVariant): string {
    return v.id;
  }

  trackByProductId(_: number, p: Product): string {
    return p.id;
  }

  // ===== Delete openers =====
  deleteProduct(p: Product): void {
    if (this.activeTab() !== 'products') return;
    if (!p?.id) return;

    this.deleteState.set({ type: 'product', id: p.id, name: p.productName ?? 'Proizvod' });
    this.deleteOpen.set(true);
  }

  deleteVariant(v: ProductVariant): void {
    if (this.activeTab() !== 'models') return;
    if (!v?.id) return;

    // Za naziv u dialogu koristimo productName (po tvom prikazu u listi)
    this.deleteState.set({ type: 'variant', id: v.id, name: v.productName ?? 'Model' });
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    if (this.deleteBusy()) return;
    this.deleteOpen.set(false);
    this.deleteState.set(null);
  }

  confirmDelete(): void {
    const st = this.deleteState();
    if (!st?.id || this.deleteBusy()) return;

    this.deleteBusy.set(true);
    this.error.set(null);

    const req$ =
      st.type === 'variant'
        ? this.api.deleteVariant(st.id)
        : this.api.deleteProduct(st.id);

    req$.subscribe({
      next: () => {
        if (st.type === 'variant') {
          const updated = this.variants().filter((x) => x.id !== st.id);
          this.variants.set(updated);
          this.totalVariants.set(updated.length);
        } else {
          const updated = this.products().filter((x) => x.id !== st.id);
          this.products.set(updated);
          this.totalProducts.set(updated.length);
        }

        this.deleteBusy.set(false);
        this.deleteOpen.set(false);
        this.deleteState.set(null);
      },
      error: (err) => {
        this.deleteBusy.set(false);

        const msg =
          err?.status === 401 || err?.status === 403
            ? 'Nemate dozvolu (provjeri admin token / role).'
            : st.type === 'variant'
              ? 'Greška pri brisanju modela. Pokušajte ponovo.'
              : 'Greška pri brisanju proizvoda. Pokušajte ponovo.';
        this.error.set(msg);
      },
    });
  }
}
