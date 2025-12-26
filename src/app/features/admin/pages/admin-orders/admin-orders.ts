import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, startWith, tap } from 'rxjs/operators';
import { AdminOrder } from '../../../../core/admin-api/admin-orders.models';
import { AdminOrdersApi } from '../../../../core/admin-api/admin-prders-api';


@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss',
})
export class AdminOrders {
  private readonly api = inject(AdminOrdersApi);

  readonly startDate = new FormControl<string>('', { nonNullable: true });
  readonly endDate = new FormControl<string>('', { nonNullable: true });

  readonly startSig = toSignal(
    this.startDate.valueChanges.pipe(startWith(this.startDate.value)),
    { initialValue: this.startDate.value },
  );

  readonly endSig = toSignal(
    this.endDate.valueChanges.pipe(startWith(this.endDate.value)),
    { initialValue: this.endDate.value },
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly orders = signal<AdminOrder[]>([]);
  readonly expandedOrderId = signal<string | null>(null);

  private normalize(value: string): string {
    return (value ?? '').trim();
  }

  readonly startValue = computed(() => this.normalize(this.startSig()));
  readonly endValue = computed(() => this.normalize(this.endSig()));

  readonly hasBothDates = computed(() => !!this.startValue() && !!this.endValue());

  // datetime-local: "YYYY-MM-DDTHH:mm" => leksikografsko poređenje radi stabilno
  readonly startEndValid = computed(() => {
    if (!this.hasBothDates()) return false;
    return this.startValue() < this.endValue();
  });

  // poruka se prikazuje samo kad su oba popunjena i nevalidna
  readonly showRangeError = computed(() => this.hasBothDates() && !this.startEndValid());

  readonly canSearch = computed(() => this.hasBothDates() && this.startEndValid() && !this.loading());

  onSearch(): void {
    const start = this.startValue();
    const end = this.endValue();

    this.error.set(null);

    if (!start || !end) {
      this.error.set('Izaberite start i end datum.');
      return;
    }

    if (!(start < end)) {
      this.error.set('Start datum mora biti manji od end datuma.');
      return;
    }

    this.fetchOrders(start, end);
  }

  private fetchOrders(start: string, end: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getByDate(start, end)
      .pipe(
        tap((res) => {
          this.orders.set(res ?? []);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.orders.set([]);

          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju narudžbi. Pokušajte ponovo.';
          this.error.set(msg);

          return of([]);
        }),
      )
      .subscribe();
  }

  toggleExpand(orderId: string): void {
    this.expandedOrderId.update((v) => (v === orderId ? null : orderId));
  }

  isExpanded(orderId: string): boolean {
    return this.expandedOrderId() === orderId;
  }

  formatPrice(v: number): string {
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }

  // Actions placeholders (kasnije)
  completeOrder(_o: AdminOrder): void {}
  cancelOrder(_o: AdminOrder): void {}
  returnOrder(_o: AdminOrder): void {}

  trackByOrderId(_: number, o: AdminOrder): string {
    return o.orderId;
  }

  trackByItemSku(_: number, i: AdminOrder['items'][number]): string {
    return i.productSku + ':' + i.sizeAttributeVariantId;
  }
}
