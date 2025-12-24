import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CartMoney {
  amount: number;
  currency: string;
}

export interface CartImage {
  url: string;
  alt: string;
}

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  sku?: string;
  size?: string | null;
  image?: CartImage | null;

  unitPrice: CartMoney;
  qty: number;
  slug?: string;
}

type StorageKind = 'local' | 'session';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private storageKind: StorageKind = 'local';
  private storageKey = 'beatovic_cart_v1';

  private _items = signal<CartItem[]>(this.readFromStorage());

  items = computed(() => this._items());

  itemsCount = computed(() => this._items().reduce((sum, i) => sum + i.qty, 0));

  subtotal = computed(() => {
    const items = this._items();
    if (!items.length) return { amount: 0, currency: 'KM' } as CartMoney;

    const currency = items[0].unitPrice.currency ?? 'KM';
    const amount = items.reduce((sum, i) => sum + i.unitPrice.amount * i.qty, 0);
    return { amount, currency };
  });

  freeShippingThreshold = signal<CartMoney>({ amount: 99.99, currency: 'KM' });

  amountToFreeShipping = computed(() => {
    const t = this.freeShippingThreshold();
    const s = this.subtotal();
    if (t.currency !== s.currency) return { amount: t.amount, currency: t.currency }; // fallback
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
    const qtyToAdd = Math.max(1, item.qty ?? 1);
    const current = this._items();

    const idx = current.findIndex(x => x.id === item.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = { ...next[idx], qty: next[idx].qty + qtyToAdd };
      this._items.set(next);
      return;
    }

    this._items.set([...current, { ...item, qty: qtyToAdd }]);
  }

  setQty(id: string, qty: number) {
    const q = Math.max(1, Math.floor(qty || 1));
    const current = this._items();
    const idx = current.findIndex(x => x.id === id);
    if (idx < 0) return;

    const next = [...current];
    next[idx] = { ...next[idx], qty: q };
    this._items.set(next);
  }

  inc(id: string) {
    const it = this._items().find(x => x.id === id);
    if (!it) return;
    this.setQty(id, it.qty + 1);
  }

  dec(id: string) {
    const it = this._items().find(x => x.id === id);
    if (!it) return;
    if (it.qty <= 1) return;
    this.setQty(id, it.qty - 1);
  }

  remove(id: string) {
    this._items.set(this._items().filter(x => x.id !== id));
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
      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(x => x && typeof x.id === 'string')
        .map(x => ({ ...x, qty: Math.max(1, Number(x.qty || 1)) }));
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
}
