import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize, startWith, tap } from 'rxjs/operators';
import { AdminOrder, OrderStatus } from '../../../../core/admin-api/admin-orders.models';
import { AdminOrdersApi } from '../../../../core/admin-api/admin-prders-api';
import { ConfirmDialog, ConfirmVariant } from '../../../../shared/ui/confirm-dialog/confirm-dialog';

type OrderAction = 'approve' | 'cancel' | 'details';
type OrderStatusTone = 'pending' | 'email-verified' | 'completed' | 'canceled' | 'expired';
type OrderMutation = 'complete' | 'cancel';

type OrdersSearchContext =
  | {
      mode: 'date';
      start: string;
      end: string;
    }
  | {
      mode: 'email';
      email: string;
    }
  | null;

interface ActionNotice {
  kind: 'success' | 'error';
  message: string;
}

interface OrderStatusUiConfig {
  label: string;
  tone: OrderStatusTone;
  actions: readonly OrderAction[];
}

const ORDER_STATUS_UI: Record<OrderStatus, OrderStatusUiConfig> = {
  PENDING: {
    label: 'Čeka email potvrdu',
    tone: 'pending',
    actions: ['details'],
  },
  EMAIL_VERIFIED: {
    label: 'Email potvrđen',
    tone: 'email-verified',
    actions: ['approve', 'cancel', 'details'],
  },
  EXPIRED: {
    label: 'Istekla potvrda',
    tone: 'expired',
    actions: ['details'],
  },
  COMPLETED: {
    label: 'Završena',
    tone: 'completed',
    actions: ['details'],
  },
  CANCELED: {
    label: 'Otkazana',
    tone: 'canceled',
    actions: ['details'],
  },
};

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDialog],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss',
})
export class AdminOrders implements OnDestroy {
  private readonly api = inject(AdminOrdersApi);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly startDate = new FormControl<string>('', { nonNullable: true });
  readonly endDate = new FormControl<string>('', { nonNullable: true });
  readonly email = new FormControl<string>('', { nonNullable: true });

  readonly startSig = toSignal(this.startDate.valueChanges.pipe(startWith(this.startDate.value)), {
    initialValue: this.startDate.value,
  });

  readonly endSig = toSignal(this.endDate.valueChanges.pipe(startWith(this.endDate.value)), {
    initialValue: this.endDate.value,
  });
  readonly emailSig = toSignal(this.email.valueChanges.pipe(startWith(this.email.value)), {
    initialValue: this.email.value,
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly orders = signal<AdminOrder[]>([]);
  readonly expandedOrderId = signal<string | null>(null);
  readonly lastSearchContext = signal<OrdersSearchContext>(null);

  readonly confirmOpen = signal(false);
  readonly confirmBusy = signal(false);
  readonly confirmAction = signal<OrderMutation | null>(null);
  readonly confirmOrder = signal<AdminOrder | null>(null);

  readonly rowActionBusyOrderId = signal<string | null>(null);
  readonly rowActionBusyType = signal<OrderMutation | null>(null);

  readonly actionNotice = signal<ActionNotice | null>(null);

  private normalize(value: string): string {
    return (value ?? '').trim();
  }

  readonly startValue = computed(() => this.normalize(this.startSig()));
  readonly endValue = computed(() => this.normalize(this.endSig()));
  readonly emailValue = computed(() => this.normalize(this.emailSig()));

  readonly hasBothDates = computed(() => !!this.startValue() && !!this.endValue());

  // datetime-local: "YYYY-MM-DDTHH:mm" => leksikografsko poređenje radi stabilno
  readonly startEndValid = computed(() => {
    if (!this.hasBothDates()) return false;
    return this.startValue() < this.endValue();
  });

  // poruka se prikazuje samo kad su oba popunjena i nevalidna
  readonly showRangeError = computed(() => this.hasBothDates() && !this.startEndValid());

  readonly canSearch = computed(
    () => this.hasBothDates() && this.startEndValid() && !this.loading(),
  );
  readonly canSearchByEmail = computed(() => {
    const email = this.emailValue();
    return email.length >= 3 && !this.loading();
  });

  readonly confirmTitle = computed(() => {
    if (this.confirmAction() === 'cancel') return 'Otkaži narudžbinu';
    return 'Odobri narudžbinu';
  });

  readonly confirmMessage = computed(() => {
    const order = this.confirmOrder();
    if (!order) return '';

    if (this.confirmAction() === 'cancel') {
      return `Da li ste sigurni da želite da otkažete narudžbinu ${order.orderId}?`;
    }

    return `Da li ste sigurni da želite da odobrite narudžbinu ${order.orderId}?`;
  });

  readonly confirmButtonText = computed(() => {
    if (this.confirmAction() === 'cancel') return 'Da, otkaži';
    return 'Da, odobri';
  });

  readonly confirmVariant = computed<ConfirmVariant>(() => {
    return this.confirmAction() === 'cancel' ? 'danger' : 'default';
  });

  readonly confirmIcon = computed(() => {
    return this.confirmAction() === 'cancel' ? '⚠' : '✓';
  });

  ngOnDestroy(): void {
    this.clearNoticeTimer();
  }

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

    this.lastSearchContext.set({ mode: 'date', start, end });
    this.fetchOrders(start, end);
  }

  onSearchByEmail(): void {
    const email = this.emailValue();
    this.error.set(null);

    if (!email) {
      this.error.set('Unesite email adresu.');
      return;
    }

    this.lastSearchContext.set({ mode: 'email', email });
    this.fetchOrdersByEmail(email);
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

  private fetchOrdersByEmail(email: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getByEmailUnregistered(email)
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
              : 'Greška pri učitavanju narudžbi po email-u. Pokušajte ponovo.';
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

  completeOrder(order: AdminOrder): void {
    if (!this.hasAction(order, 'approve') || this.isRowBusy(order)) return;
    this.openConfirm('complete', order);
  }

  cancelOrder(order: AdminOrder): void {
    if (!this.hasAction(order, 'cancel') || this.isRowBusy(order)) return;
    this.openConfirm('cancel', order);
  }

  confirmMutation(): void {
    const order = this.confirmOrder();
    const action = this.confirmAction();
    if (!order || !action || this.confirmBusy()) return;

    this.confirmBusy.set(true);
    this.error.set(null);
    this.rowActionBusyOrderId.set(order.orderId);
    this.rowActionBusyType.set(action);

    const request$ =
      action === 'complete'
        ? this.api.completeOrder(order.orderId)
        : this.api.cancelOrder(order.orderId);

    request$
      .pipe(
        tap(() => {
          const successMsg =
            action === 'complete'
              ? 'Narudžbina je uspješno odobrena.'
              : 'Narudžbina je uspješno otkazana.';

          this.showNotice('success', successMsg);
          this.refreshOrders();
        }),
        catchError((err) => {
          const msg = this.buildMutationErrorMessage(action, err);
          this.error.set(msg);
          this.showNotice('error', msg);
          return of(null);
        }),
        finalize(() => {
          this.confirmBusy.set(false);
          this.rowActionBusyOrderId.set(null);
          this.rowActionBusyType.set(null);
          this.closeConfirm(true);
        }),
      )
      .subscribe();
  }

  closeConfirm(force = false): void {
    if (!force && this.confirmBusy()) return;
    this.confirmOpen.set(false);
    this.confirmOrder.set(null);
    this.confirmAction.set(null);
  }

  isRowBusy(order: AdminOrder): boolean {
    return this.rowActionBusyOrderId() === order.orderId || this.loading();
  }

  isActionBusy(order: AdminOrder, action: OrderMutation): boolean {
    return this.rowActionBusyOrderId() === order.orderId && this.rowActionBusyType() === action;
  }

  closeNotice(): void {
    this.actionNotice.set(null);
    this.clearNoticeTimer();
  }

  statusLabel(status: OrderStatus): string {
    return ORDER_STATUS_UI[status].label;
  }

  statusClass(status: OrderStatus): string {
    return ORDER_STATUS_UI[status].tone;
  }

  hasAction(order: AdminOrder, action: OrderAction): boolean {
    return ORDER_STATUS_UI[order.status].actions.includes(action);
  }

  trackByOrderId(_: number, o: AdminOrder): string {
    return o.orderId;
  }

  trackByItemSku(_: number, i: AdminOrder['items'][number]): string {
    return i.productSku + ':' + i.sizeAttributeVariantId;
  }

  private openConfirm(action: OrderMutation, order: AdminOrder): void {
    this.confirmAction.set(action);
    this.confirmOrder.set(order);
    this.confirmBusy.set(false);
    this.confirmOpen.set(true);
  }

  private refreshOrders(): void {
    const context = this.lastSearchContext();

    if (!context) return;

    if (context.mode === 'date') {
      this.fetchOrders(context.start, context.end);
      return;
    }

    this.fetchOrdersByEmail(context.email);
  }

  private showNotice(kind: ActionNotice['kind'], message: string): void {
    this.actionNotice.set({ kind, message });
    this.clearNoticeTimer();
    this.noticeTimer = setTimeout(() => this.actionNotice.set(null), 3500);
  }

  private clearNoticeTimer(): void {
    if (!this.noticeTimer) return;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
  }

  private buildMutationErrorMessage(action: OrderMutation, err: unknown): string {
    const status = this.statusFromError(err);
    const backendMessage = this.extractErrorMessage(err);
    if (backendMessage) return backendMessage;

    if (status === 401 || status === 403) {
      return 'Nemate dozvolu (provjeri admin token / role).';
    }

    if (status === 404) {
      return 'Narudžbina nije pronađena ili više nije dostupna.';
    }

    if (status === 409 || status === 422) {
      return action === 'complete'
        ? 'Narudžbinu trenutno nije moguće odobriti jer njen status više nije validan.'
        : 'Narudžbinu trenutno nije moguće otkazati jer njen status više nije validan.';
    }

    return action === 'complete'
      ? 'Greška pri odobravanju narudžbine. Pokušajte ponovo.'
      : 'Greška pri otkazivanju narudžbine. Pokušajte ponovo.';
  }

  private statusFromError(err: unknown): number | null {
    if (!err || typeof err !== 'object') return null;
    const status = (err as Record<string, unknown>)['status'];
    return typeof status === 'number' ? status : null;
  }

  private extractErrorMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') return null;
    const root = err as Record<string, unknown>;

    const nested = root['error'];
    if (typeof nested === 'string') {
      const rawNested = this.safeString(nested);
      if (rawNested) return rawNested;
    } else if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedMessage =
        this.safeString(nestedRecord['message']) ??
        this.safeString(nestedRecord['error']) ??
        this.safeString(nestedRecord['title']) ??
        null;
      if (nestedMessage) return nestedMessage;
    }

    const direct = this.safeString(root['message']);
    if (!direct) return null;
    if (direct.toLowerCase().startsWith('http failure response')) return null;
    return direct;
  }

  private safeString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
