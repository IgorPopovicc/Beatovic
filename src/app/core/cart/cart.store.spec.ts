import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CartStore } from './cart.store';

describe('CartStore', () => {
  let store: CartStore;

  const item = (id: string, size: string, qty = 1, maxQty = 10) => ({
    id,
    productId: 'variant-1',
    name: 'Test model',
    sku: 'MODEL-1',
    size,
    unitPrice: { amount: 25, currency: 'BAM' },
    qty,
    maxQty,
  });

  beforeEach(() => {
    window.localStorage.removeItem('beatovic_cart_v1');
    TestBed.configureTestingModule({
      providers: [
        CartStore,
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    store = TestBed.inject(CartStore);
  });

  afterEach(() => {
    window.localStorage.removeItem('beatovic_cart_v1');
  });

  it('merges repeated adds of the same variant and size for quantities 1, 2, and 3', () => {
    store.add(item('size-entry-42::42', '42', 1));
    store.add(item('legacy-line::42', '42', 2));
    store.add(item('size-entry-42::42', '42', 3));

    expect(store.items().length).toBe(1);
    expect(store.items()[0].qty).toBe(6);
    expect(store.itemsCount()).toBe(6);
    expect(store.subtotal().amount).toBe(150);
  });

  it('keeps different sizes as distinct cart lines', () => {
    store.add(item('size-entry-42::42', '42'));
    store.add(item('size-entry-43::43', '43'));

    expect(store.items().map((entry) => entry.size)).toEqual(['42', '43']);
    expect(store.itemsCount()).toBe(2);
  });

  it('increments, decrements, and clamps quantity to available stock', () => {
    store.add(item('size-entry-42::42', '42', 2, 3));

    store.inc('size-entry-42::42');
    store.inc('size-entry-42::42');
    expect(store.items()[0].qty).toBe(3);

    store.dec('size-entry-42::42');
    expect(store.items()[0].qty).toBe(2);

    store.setQty('size-entry-42::42', 99);
    expect(store.items()[0].qty).toBe(3);
  });

  it('removes a line without changing the remaining size', () => {
    store.add(item('size-entry-42::42', '42'));
    store.add(item('size-entry-43::43', '43'));

    store.remove('size-entry-42::42');

    expect(store.items().length).toBe(1);
    expect(store.items()[0].size).toBe('43');
  });

  it('persists the normalized cart state in local storage', () => {
    store.add(item('size-entry-42::42', '42', 2));
    TestBed.flushEffects();

    const persisted = JSON.parse(window.localStorage.getItem('beatovic_cart_v1') ?? '[]') as Array<{
      id: string;
      qty: number;
      size: string;
    }>;

    expect(persisted).toEqual([
      jasmine.objectContaining({ id: 'size-entry-42::42', qty: 2, size: '42' }),
    ]);
  });

  it('restores the persisted quantity after a new application session', () => {
    store.add(item('size-entry-42::42', '42', 3));
    TestBed.flushEffects();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CartStore,
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const restoredStore = TestBed.inject(CartStore);

    expect(restoredStore.items()).toEqual([
      jasmine.objectContaining({ id: 'size-entry-42::42', qty: 3, size: '42' }),
    ]);
    expect(restoredStore.itemsCount()).toBe(3);
    expect(restoredStore.subtotal().amount).toBe(75);
  });
});
