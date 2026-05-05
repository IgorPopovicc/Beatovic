// src/app/core/cart/cart.store.ts
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { APP_CURRENCY_CODE, normalizeCurrencyCode } from '../../shared/utils/currency';

export interface CartMoney {
  amount: number;
  currency: string;
}

export interface CartImage {
  url: string;
  alt: string;
}

export interface CartItem {
  /**
   * Cart line id (unique per item in cart). We store it as:
   *   `${sizeVariantAttributeId}::${sizeValue}`
   * so we can merge quantities per selected size.
   */
  id: string;

  /**
   * ProductVariant id (the model id you open on details page).
   * Useful for navigation back to details, but NOT used for order payload.
   */
  productId?: string;

  name: string;
  sku?: string;
  size?: string | null;
  image?: CartImage | null;

  unitPrice: CartMoney;
  qty: number;
  maxQty?: number | null;

  // optional for routing
  slug?: string;
}

export interface CartAddEvent {
  id: number;
  item: CartItem;
  qtyAdded: number;
  qtyInCart: number;
  merged: boolean;
}

type StorageKind = 'local' | 'session';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private storageKind: StorageKind = 'local';
  private storageKey = 'beatovic_cart_v1';

  private _items = signal<CartItem[]>(this.readFromStorage());
  private _lastAddEvent = signal<CartAddEvent | null>(null);

  items = computed(() => this._items());
  lastAddEvent = computed(() => this._lastAddEvent());

  itemsCount = computed(() => this._items().reduce((sum, i) => sum + i.qty, 0));

  subtotal = computed(() => {
    const items = this._items();
    if (!items.length) return { amount: 0, currency: APP_CURRENCY_CODE } as CartMoney;

    const currency = normalizeCurrencyCode(items[0].unitPrice.currency);
    const amount = items.reduce((sum, i) => sum + i.unitPrice.amount * i.qty, 0);
    return { amount, currency };
  });

  freeShippingThreshold = signal<CartMoney>({ amount: 99.99, currency: APP_CURRENCY_CODE });

  amountToFreeShipping = computed(() => {
    const t = this.freeShippingThreshold();
    const s = this.subtotal();
    if (t.currency !== s.currency) return { amount: t.amount, currency: t.currency };
    return { amount: Math.max(0, t.amount - s.amount), currency: t.currency };
  });

  freeShippingProgress = computed(() => {
    const t = this.freeShippingThreshold();
    const s = this.subtotal();
    if (!t.amount) return 0;
    if (t.currency !== s.currency) return 0;
    return Math.max(0, Math.min(1, s.amount / t.amount));
  });

  constructor() {
    effect(() => {
      const items = this._items();
      this.writeToStorage(items);
    });
  }

  add(item: Omit<CartItem, 'qty'> & { qty?: number }) {
    const candidate = this.normalizeRuntimeItem(item);
    const qtyToAdd = Math.max(1, candidate.qty);
    const current = this._items();

    const idx = this.findMatchingIndex(current, candidate);
    if (idx >= 0) {
      const next = [...current];
      const existing = next[idx];
      const merged = this.mergeItemMeta(existing, candidate);
      const nextQty = this.clampQty(existing.qty + qtyToAdd, merged.maxQty);
      const qtyAdded = Math.max(0, nextQty - existing.qty);
      next[idx] = { ...merged, qty: nextQty };
      this._items.set(next);
      this.emitAddEvent(next[idx], qtyAdded, true);
      return;
    }

    const created: CartItem = {
      ...candidate,
      qty: this.clampQty(qtyToAdd, candidate.maxQty),
    };
    this._items.set([...current, created]);
    this.emitAddEvent(created, created.qty, false);
  }

  setQty(id: string, qty: number) {
    const current = this._items();
    const idx = current.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const next = [...current];
    const q = this.clampQty(qty, next[idx].maxQty);
    next[idx] = { ...next[idx], qty: q };
    this._items.set(next);
  }

  inc(id: string) {
    const it = this._items().find((x) => x.id === id);
    if (!it) return;
    this.setQty(id, it.qty + 1);
  }

  dec(id: string) {
    const it = this._items().find((x) => x.id === id);
    if (!it) return;
    if (it.qty <= 1) return;
    this.setQty(id, it.qty - 1);
  }

  remove(id: string) {
    this._items.set(this._items().filter((x) => x.id !== id));
  }

  clear() {
    this._items.set([]);
  }

  private get storage(): Storage | null {
    if (!this.isBrowser) return null;
    return this.storageKind === 'local' ? window.localStorage : window.sessionStorage;
  }

  private readFromStorage(): CartItem[] {
    if (!this.isBrowser) return [];
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      const deduped: CartItem[] = [];
      for (const rawItem of parsed) {
        const item = this.normalizeStoredItem(rawItem);
        if (!item) continue;

        const idx = this.findMatchingIndex(deduped, item);
        if (idx < 0) {
          deduped.push(item);
          continue;
        }

        const existing = deduped[idx];
        const merged = this.mergeItemMeta(existing, item);
        const mergedQty = this.clampQty(existing.qty + item.qty, merged.maxQty);
        deduped[idx] = { ...merged, qty: mergedQty };
      }

      return deduped;
    } catch {
      return [];
    }
  }

  private writeToStorage(items: CartItem[]) {
    if (!this.isBrowser) return;
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(items));
    } catch {}
  }

  private emitAddEvent(item: CartItem, qtyAdded: number, merged: boolean): void {
    this._lastAddEvent.set({
      id: Date.now(),
      item,
      qtyAdded,
      qtyInCart: item.qty,
      merged,
    });
  }

  private normalizeStoredItem(raw: unknown): CartItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;

    const id = this.normalizeText(entry['id'] ?? entry['lineId'] ?? entry['cartItemId']);
    const productId = this.normalizeOptionalText(
      entry['productId'] ?? entry['variantId'] ?? entry['productVariantId'],
    );
    const sku = this.normalizeOptionalText(entry['sku'] ?? entry['productSku'] ?? entry['variantSku']);
    const size = this.normalizeSize(entry['size'] ?? entry['selectedSize'] ?? entry['sizeValue']);

    const normalizedId = id || this.fallbackLineId(productId, sku, size);
    if (!normalizedId) return null;

    const unitPriceRaw =
      entry['unitPrice'] && typeof entry['unitPrice'] === 'object'
        ? (entry['unitPrice'] as Record<string, unknown>)
        : null;

    const amount = Number(unitPriceRaw?.['amount'] ?? entry['price'] ?? 0);
    const qty = this.parseQty(entry['qty'] ?? entry['quantity']);
    const maxQty = this.parseMaxQty(entry['maxQty'] ?? entry['availableStock'] ?? entry['stock']);

    const normalized: CartItem = {
      id: normalizedId,
      productId,
      name:
        this.normalizeText(entry['name'] ?? entry['productName'] ?? entry['title'] ?? 'Proizvod') ||
        'Proizvod',
      sku,
      size,
      image: this.normalizeImage(entry['image']),
      unitPrice: {
        amount: Number.isFinite(amount) ? amount : 0,
        currency: normalizeCurrencyCode(unitPriceRaw?.['currency'] ?? entry['currency']),
      },
      qty: this.clampQty(qty, maxQty),
      ...(maxQty !== null ? { maxQty } : {}),
      slug: this.normalizeOptionalText(entry['slug']),
    };

    return normalized;
  }

  private normalizeRuntimeItem(item: Omit<CartItem, 'qty'> & { qty?: number }): CartItem {
    const id = this.normalizeText(item.id);
    const productId = this.normalizeOptionalText(item.productId);
    const sku = this.normalizeOptionalText(item.sku);
    const size = this.normalizeSize(item.size);
    const maxQty = this.parseMaxQty(item.maxQty);
    const fallbackId = this.fallbackLineId(productId, sku, size);

    const amount = Number(item.unitPrice?.amount ?? 0);
    return {
      ...item,
      id: id || fallbackId,
      productId,
      sku,
      size,
      unitPrice: {
        amount: Number.isFinite(amount) ? amount : 0,
        currency: normalizeCurrencyCode(item.unitPrice?.currency),
      },
      qty: this.parseQty(item.qty),
      ...(maxQty !== null ? { maxQty } : {}),
    };
  }

  private findMatchingIndex(items: CartItem[], candidate: CartItem): number {
    const exactIdIndex = items.findIndex((x) => this.normalizeText(x.id) === this.normalizeText(candidate.id));
    if (exactIdIndex >= 0) return exactIdIndex;

    const candidateKey = this.dedupKey(candidate);
    if (!candidateKey) return -1;
    return items.findIndex((x) => this.dedupKey(x) === candidateKey);
  }

  private dedupKey(item: CartItem): string {
    const size = this.extractNormalizedSize(item);
    const variantKey =
      this.normalizeOptionalText(item.productId) ??
      this.normalizeOptionalText(item.sku) ??
      this.normalizeOptionalText(this.legacyVariantHintFromId(item.id));

    if (!variantKey) return '';
    return `${variantKey}::${size ?? ''}`;
  }

  private mergeItemMeta(existing: CartItem, incoming: CartItem): CartItem {
    const incomingMaxQty = this.parseMaxQty(incoming.maxQty);
    const existingMaxQty = this.parseMaxQty(existing.maxQty);
    const mergedMaxQty = incomingMaxQty ?? existingMaxQty;

    return {
      ...existing,
      ...incoming,
      id: this.normalizeText(incoming.id) || this.normalizeText(existing.id),
      productId: this.normalizeOptionalText(incoming.productId) ?? this.normalizeOptionalText(existing.productId),
      sku: this.normalizeOptionalText(incoming.sku) ?? this.normalizeOptionalText(existing.sku),
      size: this.normalizeSize(incoming.size) ?? this.normalizeSize(existing.size),
      unitPrice: incoming.unitPrice ?? existing.unitPrice,
      ...(mergedMaxQty !== null ? { maxQty: mergedMaxQty } : {}),
    };
  }

  private extractNormalizedSize(item: CartItem): string | null {
    const explicitSize = this.normalizeSize(item.size);
    if (explicitSize) return explicitSize;

    const parts = this.normalizeText(item.id).split('::');
    return this.normalizeSize(parts[1] ?? null);
  }

  private legacyVariantHintFromId(id: string): string | null {
    const normalizedId = this.normalizeText(id);
    if (!normalizedId) return null;
    const parts = normalizedId.split('::');
    if (parts.length !== 1) return null;
    return this.normalizeOptionalText(parts[0]) ?? null;
  }

  private fallbackLineId(productId?: string, sku?: string, size?: string | null): string {
    const variantKey = this.normalizeOptionalText(productId) ?? this.normalizeOptionalText(sku);
    if (!variantKey) return '';
    const normalizedSize = this.normalizeSize(size);
    return normalizedSize ? `${variantKey}::${normalizedSize}` : variantKey;
  }

  private normalizeImage(raw: unknown): CartImage | null {
    if (!raw || typeof raw !== 'object') return null;
    const image = raw as Record<string, unknown>;
    const url = this.normalizeText(image['url']);
    const alt = this.normalizeText(image['alt']);
    if (!url) return null;
    return { url, alt };
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeOptionalText(value: unknown): string | undefined {
    const normalized = this.normalizeText(value);
    return normalized || undefined;
  }

  private normalizeSize(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized || null;
  }

  private parseQty(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.floor(parsed));
  }

  private parseMaxQty(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const floored = Math.floor(parsed);
    if (floored < 1) return null;
    return floored;
  }

  private clampQty(value: number, maxQty?: number | null): number {
    const normalized = this.parseQty(value);
    const max = this.parseMaxQty(maxQty);
    if (max === null) return normalized;
    return Math.min(normalized, max);
  }
}
