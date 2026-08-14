import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize, startWith, tap } from 'rxjs/operators';
import { AdminOrder, OrderStatus } from '../../../../core/admin-api/admin-orders.models';
import {
  AdminOrdersApi,
  UpdateOrderItemRequest,
} from '../../../../core/admin-api/admin-prders-api';
import { ConfirmDialog, ConfirmVariant } from '../../../../shared/ui/confirm-dialog/confirm-dialog';

type OrderAction = 'approve' | 'cancel' | 'details';
type OrderStatusTone =
  | 'pending'
  | 'email-verified'
  | 'waiting-reconfirm'
  | 'customer-reconfirmed'
  | 'completed'
  | 'canceled'
  | 'expired';
type OrderMutation = 'complete' | 'cancel' | 'remove-coupon';
type RowActionKind = OrderMutation | 'reconfirm' | 'anonymize' | 'update-items';

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
  | {
      mode: 'order-number';
      orderNumber: string;
    }
  | {
      mode: 'pantheon-id';
      pantheonOrderId: string;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANONYMIZED_USER_LABEL = 'Anonimizovan korisnik';

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
  WAITING_FOR_CUSTOMER_RECONFIRMATION: {
    label: 'Čeka ponovnu potvrdu kupca',
    tone: 'waiting-reconfirm',
    actions: ['cancel', 'details'],
  },
  CUSTOMER_RECONFIRMED: {
    label: 'Kupac ponovo potvrdio',
    tone: 'customer-reconfirmed',
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
  readonly orderNumber = new FormControl<string>('', { nonNullable: true });
  readonly pantheonOrderId = new FormControl<string>('', { nonNullable: true });

  readonly startSig = toSignal(this.startDate.valueChanges.pipe(startWith(this.startDate.value)), {
    initialValue: this.startDate.value,
  });

  readonly endSig = toSignal(this.endDate.valueChanges.pipe(startWith(this.endDate.value)), {
    initialValue: this.endDate.value,
  });
  readonly emailSig = toSignal(this.email.valueChanges.pipe(startWith(this.email.value)), {
    initialValue: this.email.value,
  });
  readonly orderNumberSig = toSignal(
    this.orderNumber.valueChanges.pipe(startWith(this.orderNumber.value)),
    { initialValue: this.orderNumber.value },
  );
  readonly pantheonOrderIdSig = toSignal(
    this.pantheonOrderId.valueChanges.pipe(startWith(this.pantheonOrderId.value)),
    { initialValue: this.pantheonOrderId.value },
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly orders = signal<AdminOrder[]>([]);
  readonly editedItemQuantities = signal<Record<string, number>>({});
  readonly expandedOrderId = signal<string | null>(null);
  readonly lastSearchContext = signal<OrdersSearchContext>(null);

  readonly confirmOpen = signal(false);
  readonly confirmBusy = signal(false);
  readonly confirmAction = signal<OrderMutation | null>(null);
  readonly confirmOrder = signal<AdminOrder | null>(null);

  readonly anonymizeConfirmOpen = signal(false);
  readonly anonymizeConfirmBusy = signal(false);
  readonly anonymizeTargetEmail = signal('');

  readonly rowActionBusyOrderId = signal<string | null>(null);
  readonly rowActionBusyType = signal<RowActionKind | null>(null);

  readonly actionNotice = signal<ActionNotice | null>(null);

  private normalize(value: string): string {
    return (value ?? '').trim();
  }

  readonly startValue = computed(() => this.normalize(this.startSig()));
  readonly endValue = computed(() => this.normalize(this.endSig()));
  readonly emailValue = computed(() => this.normalize(this.emailSig()));
  readonly orderNumberValue = computed(() => this.normalize(this.orderNumberSig()));
  readonly pantheonOrderIdValue = computed(() => this.normalize(this.pantheonOrderIdSig()));

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
    return this.isValidEmail(email) && !this.loading();
  });
  readonly canSearchByOrderNumber = computed(
    () => this.orderNumberValue().length > 0 && !this.loading(),
  );
  readonly canSearchByPantheonId = computed(
    () => /^\d+$/.test(this.pantheonOrderIdValue()) && !this.loading(),
  );

  readonly confirmTitle = computed(() => {
    if (this.confirmAction() === 'cancel') return 'Otkaži narudžbu';
    if (this.confirmAction() === 'remove-coupon') return 'Ukloni kupon';
    return 'Odobri narudžbu';
  });

  readonly confirmMessage = computed(() => {
    const order = this.confirmOrder();
    if (!order) return '';

    if (this.confirmAction() === 'cancel') {
      return `Jeste li sigurni da želite otkazati ${this.orderDisplayReference(order)}?`;
    }

    if (this.confirmAction() === 'remove-coupon') {
      return `Jeste li sigurni da želite ukloniti kupon sa ${this.orderDisplayReference(order)}?`;
    }

    return `Jeste li sigurni da želite odobriti ${this.orderDisplayReference(order)}?`;
  });

  readonly confirmButtonText = computed(() => {
    if (this.confirmAction() === 'cancel') return 'Da, otkaži';
    if (this.confirmAction() === 'remove-coupon') return 'Da, ukloni kupon';
    return 'Da, odobri';
  });

  readonly confirmVariant = computed<ConfirmVariant>(() => {
    return this.confirmAction() === 'cancel' || this.confirmAction() === 'remove-coupon'
      ? 'danger'
      : 'default';
  });

  readonly confirmIcon = computed(() => {
    return this.confirmAction() === 'cancel' || this.confirmAction() === 'remove-coupon'
      ? '⚠'
      : '✓';
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

    if (!this.isValidEmail(email)) {
      this.error.set('Unesite ispravnu email adresu.');
      return;
    }

    this.lastSearchContext.set({ mode: 'email', email });
    this.fetchOrdersByEmail(email);
  }

  onSearchByOrderNumber(): void {
    const orderNumber = this.orderNumberValue();
    if (!orderNumber) return;
    this.lastSearchContext.set({ mode: 'order-number', orderNumber });
    this.fetchSingleOrder(
      this.api.getByOrderNumber(orderNumber),
      'Narudžba sa tim brojem nije pronađena.',
    );
  }

  onSearchByPantheonId(): void {
    const pantheonOrderId = this.pantheonOrderIdValue();
    if (!/^\d+$/.test(pantheonOrderId)) {
      this.error.set('Pantheon ID mora biti cijeli broj.');
      return;
    }
    this.lastSearchContext.set({ mode: 'pantheon-id', pantheonOrderId });
    this.fetchSingleOrder(
      this.api.getByPantheonId(pantheonOrderId),
      'Narudžba sa tim Pantheon ID-em nije pronađena.',
    );
  }

  private fetchSingleOrder(
    request$: ReturnType<AdminOrdersApi['getByOrderNumber']>,
    notFound: string,
  ): void {
    this.loading.set(true);
    this.error.set(null);
    request$.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (order) => {
        this.orders.set(order ? [order] : []);
        this.editedItemQuantities.set({});
        this.expandedOrderId.set(order?.orderId ?? null);
      },
      error: (err: unknown) => {
        this.orders.set([]);
        this.editedItemQuantities.set({});
        const status = this.statusFromError(err);
        this.error.set(
          status === 404
            ? notFound
            : status === 401 || status === 403
              ? 'Nemate dozvolu za ovu pretragu.'
              : 'Pretraga narudžbe trenutno nije uspjela. Pokušajte ponovo.',
        );
      },
    });
  }

  private fetchOrders(start: string, end: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getByDate(start, end)
      .pipe(
        tap((res) => {
          this.orders.set(res ?? []);
          this.editedItemQuantities.set({});
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.orders.set([]);
          this.editedItemQuantities.set({});

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
          this.editedItemQuantities.set({});
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.orders.set([]);
          this.editedItemQuantities.set({});

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
    return new Intl.NumberFormat('bs-BA', {
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

  removeOrderCoupon(order: AdminOrder): void {
    if (!order.couponCode || this.isRowBusy(order)) return;
    this.openConfirm('remove-coupon', order);
  }

  resendOrderConfirmation(order: AdminOrder): void {
    if (!this.hasItemsChanged(order) || this.isRowBusy(order)) return;

    this.rowActionBusyOrderId.set(order.orderId);
    this.rowActionBusyType.set('reconfirm');
    this.error.set(null);

    this.api
      .resendConfirmation(order.orderId)
      .pipe(
        tap(() => {
          this.showNotice('success', 'Email za ponovnu potvrdu je uspješno poslan kupcu.');
          this.refreshOrders();
        }),
        catchError((err) => {
          const status = this.statusFromError(err);
          const backendMessage = this.extractErrorMessage(err);

          const msg =
            backendMessage ??
            (status === 401 || status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : status === 404
                ? 'Narudžba nije pronađena.'
                : status === 400
                  ? 'Ponovna potvrda trenutno nije moguća za ovu narudžbu.'
                  : 'Greška pri slanju emaila za ponovnu potvrdu.');

          this.error.set(msg);
          this.showNotice('error', msg);
          return of(null);
        }),
        finalize(() => {
          this.rowActionBusyOrderId.set(null);
          this.rowActionBusyType.set(null);
        }),
      )
      .subscribe();
  }

  openAnonymizeConfirm(): void {
    const email = this.emailValue();
    this.error.set(null);

    if (!email) {
      this.error.set('Unesite email adresu za anonimizaciju.');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.error.set('Unesite ispravnu email adresu za anonimizaciju.');
      return;
    }

    this.anonymizeTargetEmail.set(email);
    this.anonymizeConfirmBusy.set(false);
    this.anonymizeConfirmOpen.set(true);
  }

  closeAnonymizeConfirm(force = false): void {
    if (!force && this.anonymizeConfirmBusy()) return;
    this.anonymizeConfirmOpen.set(false);
    this.anonymizeTargetEmail.set('');
  }

  confirmAnonymizeByEmail(): void {
    const email = this.anonymizeTargetEmail();
    if (!email || this.anonymizeConfirmBusy()) return;

    this.error.set(null);
    this.anonymizeConfirmBusy.set(true);
    this.rowActionBusyOrderId.set(email);
    this.rowActionBusyType.set('anonymize');

    this.api
      .anonymizeCustomerByEmail(email)
      .pipe(
        tap(() => {
          this.showNotice('success', 'Podaci kupca su uspješno anonimizovani.');
          this.closeAnonymizeConfirm(true);
          this.refreshOrders();
        }),
        catchError((err) => {
          const status = this.statusFromError(err);
          const msg =
            status === 401 || status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : status === 400
                ? 'Unesite ispravnu email adresu.'
                : 'Anonimizacija trenutno nije uspjela. Pokušajte ponovo.';

          this.error.set(msg);
          this.showNotice('error', msg);
          return of(null);
        }),
        finalize(() => {
          this.anonymizeConfirmBusy.set(false);
          this.rowActionBusyOrderId.set(null);
          this.rowActionBusyType.set(null);
        }),
      )
      .subscribe();
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
        : action === 'cancel'
          ? this.api.cancelOrder(order.orderId)
          : this.api.removeOrderCoupon(order.orderId);

    request$
      .pipe(
        tap(() => {
          const successMsg =
            action === 'complete'
              ? 'Narudžba je uspješno odobrena.'
              : action === 'cancel'
                ? 'Narudžba je uspješno otkazana.'
                : 'Kupon je uspješno uklonjen sa narudžbe.';

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

  isReconfirmBusy(order: AdminOrder): boolean {
    return (
      this.rowActionBusyOrderId() === order.orderId && this.rowActionBusyType() === 'reconfirm'
    );
  }

  hasItemsChanged(order: AdminOrder): boolean {
    return order.itemsChanged === true;
  }

  customerDisplayName(order: AdminOrder): string {
    const fullName = this.safeString(order.userDetails?.fullName);
    if (fullName) return fullName;

    const email = this.safeString(order.userDetails?.email);
    return email || ANONYMIZED_USER_LABEL;
  }

  customerDisplayEmail(order: AdminOrder): string {
    return this.safeString(order.userDetails?.email) || ANONYMIZED_USER_LABEL;
  }

  customerDisplayValue(value: unknown): string {
    return this.safeString(value) || '-';
  }

  orderDisplayReference(order: AdminOrder): string {
    const orderNumber = this.safeString(order.orderNumber);
    return orderNumber ? `porudžbenicu ${orderNumber}` : 'porudžbenicu';
  }

  editedItemQuantity(orderId: string, sizeAttributeVariantId: string, fallback: number): number {
    const key = this.quantityKey(orderId, sizeAttributeVariantId);
    const edited = this.editedItemQuantities()[key];
    if (typeof edited === 'number' && Number.isFinite(edited)) return edited;
    return fallback;
  }

  onItemQuantityInput(orderId: string, sizeAttributeVariantId: string, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const nextQty = Math.max(0, Math.floor(parsed));
    const key = this.quantityKey(orderId, sizeAttributeVariantId);
    this.editedItemQuantities.update((prev) => ({ ...prev, [key]: nextQty }));
  }

  hasItemChanges(order: AdminOrder): boolean {
    const edited = this.editedItemQuantities();
    for (const item of order.items ?? []) {
      const key = this.quantityKey(order.orderId, item.sizeAttributeVariantId);
      const updated = edited[key];
      if (typeof updated !== 'number') continue;
      if (Math.floor(updated) !== Math.floor(Number(item.quantity ?? 0))) return true;
    }
    return false;
  }

  isUpdateItemsBusy(order: AdminOrder): boolean {
    return (
      this.rowActionBusyOrderId() === order.orderId && this.rowActionBusyType() === 'update-items'
    );
  }

  saveOrderItems(order: AdminOrder): void {
    if (this.isRowBusy(order) || !this.hasItemChanges(order)) return;

    const payload: UpdateOrderItemRequest[] = (order.items ?? []).map((item) => ({
      sizeAttributeVariantId: item.sizeAttributeVariantId,
      quantity: this.editedItemQuantity(order.orderId, item.sizeAttributeVariantId, item.quantity),
    }));

    const invalidQty = payload.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity <= 0,
    );
    if (invalidQty) {
      const msg = 'Količina mora biti cijeli broj veći od 0.';
      this.error.set(msg);
      this.showNotice('error', msg);
      return;
    }

    this.rowActionBusyOrderId.set(order.orderId);
    this.rowActionBusyType.set('update-items');
    this.error.set(null);

    this.api
      .updateOrderItems(order.orderId, payload)
      .pipe(
        tap((updatedOrder) => {
          this.orders.update((prev) =>
            prev.map((current) => (current.orderId === order.orderId ? updatedOrder : current)),
          );
          this.clearEditedQuantitiesForOrder(order.orderId);
          this.showNotice('success', 'Stavke narudžbe su uspješno ažurirane.');
        }),
        catchError((err) => {
          const status = this.statusFromError(err);
          const backendMessage = this.extractErrorMessage(err);
          const msg =
            backendMessage ??
            (status === 401 || status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : status === 404
                ? 'Narudžba ili stavke nisu pronađene.'
                : status === 409
                  ? 'Stanje zaliha je promijenjeno. Osvježite i pokušajte ponovo.'
                  : 'Greška pri ažuriranju stavki narudžbe.');
          this.error.set(msg);
          this.showNotice('error', msg);
          return of(null);
        }),
        finalize(() => {
          this.rowActionBusyOrderId.set(null);
          this.rowActionBusyType.set(null);
        }),
      )
      .subscribe();
  }

  closeNotice(): void {
    this.actionNotice.set(null);
    this.clearNoticeTimer();
  }

  statusLabel(status: OrderStatus): string {
    return ORDER_STATUS_UI[status]?.label ?? String(status ?? '').trim();
  }

  statusClass(status: OrderStatus): string {
    return ORDER_STATUS_UI[status]?.tone ?? 'pending';
  }

  hasAction(order: AdminOrder, action: OrderAction): boolean {
    return ORDER_STATUS_UI[order.status]?.actions.includes(action) ?? false;
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
    if (context.mode === 'email') {
      this.fetchOrdersByEmail(context.email);
      return;
    }
    if (context.mode === 'order-number') {
      this.fetchSingleOrder(
        this.api.getByOrderNumber(context.orderNumber),
        'Narudžba sa tim brojem nije pronađena.',
      );
      return;
    }
    this.fetchSingleOrder(
      this.api.getByPantheonId(context.pantheonOrderId),
      'Narudžba sa tim Pantheon ID-em nije pronađena.',
    );
  }

  private quantityKey(orderId: string, sizeAttributeVariantId: string): string {
    return `${orderId}:${sizeAttributeVariantId}`;
  }

  private clearEditedQuantitiesForOrder(orderId: string): void {
    this.editedItemQuantities.update((prev) => {
      const next: Record<string, number> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`${orderId}:`)) {
          next[key] = value;
        }
      }
      return next;
    });
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

    if (action === 'remove-coupon') {
      if (status === 409 || status === 422) {
        return 'Kupon je već uklonjen ili ga narudžba više nema.';
      }
      return 'Greška pri uklanjanju kupona. Pokušajte ponovo.';
    }

    if (status === 409 || status === 422) {
      return action === 'complete'
        ? 'Narudžbinu trenutno nije moguće odobriti jer njen status više nije validan.'
        : 'Narudžbinu trenutno nije moguće otkazati jer njen status više nije validan.';
    }

    return action === 'complete'
      ? 'Greška pri odobravanju narudžbe. Pokušajte ponovo.'
      : 'Greška pri otkazivanju narudžbe. Pokušajte ponovo.';
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

  private isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(String(email ?? '').trim());
  }

  private safeString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
