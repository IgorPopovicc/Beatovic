import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Subscription,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  finalize,
  from,
  reduce,
} from 'rxjs';

import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';
import {
  AdminVariantPrioritySearchRequest,
  BulkVariantPriorityItem,
  BulkVariantPriorityResult,
} from '../../../../core/admin-api/admin-products.models';
import { AvailableCategory, Variant } from '../../../../core/api/catalog.models';
import { runtimeMediaUrl } from '../../../../core/config/runtime-config.service';
import {
  PRODUCT_VARIANT_PRIORITIES,
  ProductVariantPriority,
  isProductVariantPriority,
} from '../../../../shared/data/product-variant-priority';

type SortKey = 'PRIORITY_DESC' | 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC';
type NoticeKind = 'success' | 'warning' | 'error';
type Notice = { id: number; kind: NoticeKind; message: string };

const PAGE_SIZE = 50;
const BULK_CHUNK_SIZE = 500;

@Component({
  selector: 'app-admin-priority-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-priority-manager.html',
  styleUrl: './admin-priority-manager.scss',
})
export class AdminPriorityManager implements OnInit, OnDestroy {
  private readonly api = inject(AdminProductsApi);
  private readonly subscriptions = new Subscription();
  private readonly noticeTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private requestSubscription?: Subscription;
  private nextNoticeId = 0;

  readonly search = new FormControl('', { nonNullable: true });
  readonly priorities = PRODUCT_VARIANT_PRIORITIES;
  readonly selectedPriorities = signal<Set<ProductVariantPriority>>(new Set());
  readonly selectedCategory = signal('');
  readonly sortKey = signal<SortKey>('PRIORITY_DESC');
  readonly page = signal(0);

  readonly loading = signal(false);
  readonly bulkBusy = signal(false);
  readonly quickBusySku = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly variants = signal<Variant[]>([]);
  readonly categories = signal<AvailableCategory[]>([]);
  readonly totalResults = signal(0);
  readonly selectedBySku = signal<Map<string, ProductVariantPriority>>(new Map());
  readonly notices = signal<Notice[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalResults() / PAGE_SIZE)));
  readonly selectedCount = computed(() => this.selectedBySku().size);
  readonly currentPageSkus = computed(() =>
    this.variants()
      .map((variant) => String(variant.sku ?? '').trim())
      .filter(Boolean),
  );
  readonly allCurrentPageSelected = computed(() => {
    const skus = this.currentPageSkus();
    return skus.length > 0 && skus.every((sku) => this.selectedBySku().has(sku));
  });
  readonly categoryGroups = computed(() =>
    this.categories()
      .map((category) => ({
        id: category.id,
        name: category.name,
        values: (category.values ?? [])
          .map((value) => ({
            id: value.id,
            label: String(value.displayValue ?? value.value ?? '').trim(),
            count: Number(value.count ?? 0),
          }))
          .filter((value) => !!value.label)
          .sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .filter((category) => category.values.length > 0),
  );

  ngOnInit(): void {
    this.subscriptions.add(
      this.search.valueChanges
        .pipe(debounceTime(350), distinctUntilChanged())
        .subscribe(() => this.applyFilters()),
    );
    this.load();
  }

  ngOnDestroy(): void {
    this.requestSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
    for (const timer of this.noticeTimers.values()) clearTimeout(timer);
  }

  applyFilters(): void {
    this.page.set(0);
    this.load();
  }

  setCategory(value: string): void {
    this.selectedCategory.set(value);
    this.applyFilters();
  }

  togglePriority(priority: ProductVariantPriority, checked: boolean): void {
    this.selectedPriorities.update((current) => {
      const next = new Set(current);
      checked ? next.add(priority) : next.delete(priority);
      return next;
    });
    this.applyFilters();
  }

  isPrioritySelected(priority: ProductVariantPriority): boolean {
    return this.selectedPriorities().has(priority);
  }

  setSort(value: SortKey): void {
    this.sortKey.set(value);
    this.applyFilters();
  }

  goToPage(page: number): void {
    const next = Math.max(0, Math.min(page, this.totalPages() - 1));
    if (next === this.page()) return;
    this.page.set(next);
    this.load();
  }

  retry(): void {
    this.load();
  }

  toggleVariant(variant: Variant, checked: boolean): void {
    const sku = String(variant.sku ?? '').trim();
    if (!sku) return;
    this.selectedBySku.update((current) => {
      const next = new Map(current);
      checked ? next.set(sku, this.priorityOf(variant)) : next.delete(sku);
      return next;
    });
  }

  toggleCurrentPage(checked: boolean): void {
    this.selectedBySku.update((current) => {
      const next = new Map(current);
      for (const variant of this.variants()) {
        const sku = String(variant.sku ?? '').trim();
        if (!sku) continue;
        checked ? next.set(sku, this.priorityOf(variant)) : next.delete(sku);
      }
      return next;
    });
  }

  isSelected(variant: Variant): boolean {
    const sku = String(variant.sku ?? '').trim();
    return !!sku && this.selectedBySku().has(sku);
  }

  clearSelection(): void {
    this.selectedBySku.set(new Map());
  }

  applyBulkPriority(priority: ProductVariantPriority): void {
    if (this.bulkBusy() || this.selectedCount() === 0) return;

    const items: BulkVariantPriorityItem[] = Array.from(this.selectedBySku().keys()).map((sku) => ({
      sku,
      priority,
    }));

    this.bulkBusy.set(true);
    this.executePriorityUpdate(items)
      .pipe(finalize(() => this.bulkBusy.set(false)))
      .subscribe({
        next: (result) => {
          this.clearSelection();
          this.showUpdateResult(result);
          this.load();
        },
        error: () => {
          this.showNotice('error', 'Promjena prioriteta nije uspjela. Pokušajte ponovo.');
          this.load();
        },
      });
  }

  setQuickPriority(variant: Variant, priority: ProductVariantPriority): void {
    const sku = String(variant.sku ?? '').trim();
    if (!sku || this.quickBusySku() || priority === this.priorityOf(variant)) return;

    this.quickBusySku.set(sku);
    this.executePriorityUpdate([{ sku, priority }])
      .pipe(finalize(() => this.quickBusySku.set(null)))
      .subscribe({
        next: (result) => {
          this.showUpdateResult(result);
          this.load();
        },
        error: () => {
          this.showNotice('error', `Prioritet za SKU ${sku} nije ažuriran.`);
          this.load();
        },
      });
  }

  priorityOf(variant: Variant): ProductVariantPriority {
    return isProductVariantPriority(variant.displayRank) ? variant.displayRank : 'NONE';
  }

  priorityLabel(priority: ProductVariantPriority): string {
    if (priority === 'HIGH') return 'Visok';
    if (priority === 'MEDIUM') return 'Srednji';
    if (priority === 'LOW') return 'Nizak';
    return 'Bez prioriteta';
  }

  imageUrl(variant: Variant): string | null {
    const raw = String(
      variant.mainImageThumbnailUrl ??
        variant.mainImageWebUrl ??
        variant.mainImageUrl ??
        variant.mainImageName ??
        '',
    ).trim();
    return runtimeMediaUrl(raw) || null;
  }

  formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
    return new Intl.NumberFormat('bs-BA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  closeNotice(id: number): void {
    this.notices.update((notices) => notices.filter((notice) => notice.id !== id));
    const timer = this.noticeTimers.get(id);
    if (timer) clearTimeout(timer);
    this.noticeTimers.delete(id);
  }

  private load(): void {
    this.requestSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.requestSubscription = this.api
      .searchVariantsForPriority(this.buildSearchRequest())
      .subscribe({
        next: (response) => {
          this.variants.set(response?.variants ?? []);
          this.categories.set(response?.availableCategories ?? []);
          this.totalResults.set(Number(response?.totalResults ?? 0));
          this.loading.set(false);
        },
        error: (err) => {
          this.variants.set([]);
          this.totalResults.set(0);
          this.loading.set(false);
          this.error.set(
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za upravljanje prioritetima.'
              : 'Lista prioriteta trenutno nije dostupna.',
          );
        },
      });
  }

  private buildSearchRequest(): AdminVariantPrioritySearchRequest {
    const { sortBy, sortOrder } = this.sortParts(this.sortKey());
    const request: AdminVariantPrioritySearchRequest = {
      page: this.page(),
      pageSize: PAGE_SIZE,
      sortBy,
      sortOrder,
    };

    const query = this.search.value.trim();
    if (query) request.searchQuery = query;

    const selectedCategory = this.selectedCategory();
    if (selectedCategory) {
      const [categoryId, valueId] = selectedCategory.split(':');
      if (categoryId && valueId) request.categoryFilters = { [categoryId]: [valueId] };
    }

    const priorities = Array.from(this.selectedPriorities());
    if (priorities.length > 0) request.priorities = priorities;

    return request;
  }

  private sortParts(
    sort: SortKey,
  ): Pick<AdminVariantPrioritySearchRequest, 'sortBy' | 'sortOrder'> {
    if (sort === 'NAME_ASC') return { sortBy: 'NAME', sortOrder: 'ASC' };
    if (sort === 'NAME_DESC') return { sortBy: 'NAME', sortOrder: 'DESC' };
    if (sort === 'PRICE_ASC') return { sortBy: 'PRICE', sortOrder: 'ASC' };
    if (sort === 'PRICE_DESC') return { sortBy: 'PRICE', sortOrder: 'DESC' };
    return { sortBy: 'PRIORITY', sortOrder: 'DESC' };
  }

  private executePriorityUpdate(items: BulkVariantPriorityItem[]) {
    const chunks: BulkVariantPriorityItem[][] = [];
    for (let index = 0; index < items.length; index += BULK_CHUNK_SIZE) {
      chunks.push(items.slice(index, index + BULK_CHUNK_SIZE));
    }

    return from(chunks).pipe(
      concatMap((chunk) => this.api.bulkUpdateVariantPriorities({ items: chunk })),
      reduce<BulkVariantPriorityResult, BulkVariantPriorityResult>(
        (aggregate, result) => ({
          updatedCount: aggregate.updatedCount + Number(result?.updatedCount ?? 0),
          notFoundCount: aggregate.notFoundCount + Number(result?.notFoundCount ?? 0),
          notFoundSkus: [...aggregate.notFoundSkus, ...(result?.notFoundSkus ?? [])],
        }),
        { updatedCount: 0, notFoundCount: 0, notFoundSkus: [] },
      ),
    );
  }

  private showUpdateResult(result: BulkVariantPriorityResult): void {
    this.showNotice('success', `Uspješno ažurirano: ${result.updatedCount}.`);
    if (result.notFoundCount > 0) {
      this.showNotice(
        'warning',
        `Nije pronađeno (${result.notFoundCount}): ${result.notFoundSkus.join(', ')}`,
      );
    }
  }

  private showNotice(kind: NoticeKind, message: string): void {
    const id = ++this.nextNoticeId;
    this.notices.update((notices) => [...notices, { id, kind, message }]);
    this.noticeTimers.set(
      id,
      setTimeout(() => this.closeNotice(id), 5500),
    );
  }
}
