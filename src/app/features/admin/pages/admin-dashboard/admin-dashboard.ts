import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { AdminOrdersApi } from '../../../../core/admin-api/admin-prders-api';
import { AdminOrder, OrderStatus } from '../../../../core/admin-api/admin-orders.models';
import { AdminProductsApi } from '../../../../core/admin-api/admin-products-api';
import { ProductVariantIdSkuPair } from '../../../../core/admin-api/admin-products.models';
import { AdminDiscountsApi } from '../../../../core/admin-api/admin-discount-api';
import { DiscountListItem } from '../../../../core/admin-api/admin-discount.model';
import { AdminCouponsApi } from '../../../../core/admin-api/admin-coupons-api';
import { CouponDetails } from '../../../../core/admin-api/admin-coupons.models';
import { AdminNewsletterApi } from '../../../../core/admin-api/admin-newsletter-api';
import { NewsletterSubscription } from '../../../../core/admin-api/admin-newsletter.models';
import { AdminContactsApi } from '../../../../core/admin-api/admin-contacts-api';
import { ContactMessage } from '../../../../core/admin-api/admin-contacts.models';

type KpiTone = 'default' | 'good' | 'warn' | 'danger';

interface KpiCard {
  title: string;
  value: string;
  hint: string;
  tone: KpiTone;
}

interface StatusMetric {
  key: string;
  label: string;
  count: number;
  ratio: number;
}

interface ProductSalesMetric {
  key: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
}

interface OrderAnalytics {
  totalOrders: number;
  todayOrders: number;
  monthOrders: number;
  yearOrders: number;
  last7DaysOrders: number;
  totalRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  avgOrderValue: number | null;
  largestOrder: AdminOrder | null;
  largestOrderAmount: number | null;
  smallestOrder: AdminOrder | null;
  smallestOrderAmount: number | null;
  pendingOrders: number;
  emailVerifiedOrders: number;
  completedOrders: number;
  canceledOrders: number;
  expiredOrders: number;
  statusMetrics: StatusMetric[];
  latestOrders: AdminOrder[];
  topByQuantity: ProductSalesMetric[];
  topByRevenue: ProductSalesMetric[];
  totalSoldUnits: number;
  ordersWithMissingDate: number;
  hasAnyOrderDate: boolean;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Čeka obradu',
  EMAIL_VERIFIED: 'Email potvrđen',
  WAITING_FOR_CUSTOMER_RECONFIRMATION: 'Čeka ponovnu potvrdu kupca',
  CUSTOMER_RECONFIRMED: 'Kupac ponovo potvrdio',
  COMPLETED: 'Završena',
  CANCELED: 'Otkazana',
  EXPIRED: 'Istekla — nije obrađena u roku',
};

const ORDER_STATUS_PRIORITY: OrderStatus[] = [
  'PENDING',
  'EMAIL_VERIFIED',
  'WAITING_FOR_CUSTOMER_RECONFIRMATION',
  'CUSTOMER_RECONFIRMED',
  'COMPLETED',
  'CANCELED',
  'EXPIRED',
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  private readonly ordersApi = inject(AdminOrdersApi);
  private readonly productsApi = inject(AdminProductsApi);
  private readonly discountsApi = inject(AdminDiscountsApi);
  private readonly couponsApi = inject(AdminCouponsApi);
  private readonly newsletterApi = inject(AdminNewsletterApi);
  private readonly contactsApi = inject(AdminContactsApi);

  readonly ordersLoading = signal(false);
  readonly ordersError = signal<string | null>(null);
  readonly orders = signal<AdminOrder[]>([]);

  readonly productsLoading = signal(false);
  readonly productsError = signal<string | null>(null);
  readonly variantPairs = signal<ProductVariantIdSkuPair[]>([]);

  readonly discountsLoading = signal(false);
  readonly discountsError = signal<string | null>(null);
  readonly discounts = signal<DiscountListItem[]>([]);

  readonly couponsLoading = signal(false);
  readonly couponsError = signal<string | null>(null);
  readonly coupons = signal<CouponDetails[]>([]);

  readonly newsletterLoading = signal(false);
  readonly newsletterError = signal<string | null>(null);
  readonly newsletterTotal = signal<number | null>(null);
  readonly newsletterMonthNew = signal<number | null>(null);
  readonly latestSubscribers = signal<NewsletterSubscription[]>([]);

  readonly contactsLoading = signal(false);
  readonly contactsError = signal<string | null>(null);
  readonly contacts = signal<ContactMessage[]>([]);

  readonly lastRefreshedAt = signal<Date | null>(null);

  readonly quickActions = [
    {
      title: 'Dodaj proizvod',
      hint: 'Upravljanje proizvodima i modelima',
      link: '/admin/products',
    },
    {
      title: 'Pregled narudžbi',
      hint: 'Odobravanje i praćenje statusa',
      link: '/admin/orders',
    },
    {
      title: 'Kreiraj popust',
      hint: 'Upravljanje kampanjama i akcijama',
      link: '/admin/discounts',
    },
    {
      title: 'Kreiraj kupon',
      hint: 'Kodovi i ograničenja korišćenja',
      link: '/admin/coupons',
    },
    {
      title: 'Newsletter pretplatnici',
      hint: 'Pregled email pretplatnika',
      link: '/admin/newsletter',
    },
    {
      title: 'Kontakt poruke',
      hint: 'Nove poruke kupaca',
      link: '/admin/contact',
    },
  ] as const;

  readonly anyLoading = computed(
    () =>
      this.ordersLoading() ||
      this.productsLoading() ||
      this.discountsLoading() ||
      this.couponsLoading() ||
      this.newsletterLoading() ||
      this.contactsLoading(),
  );

  readonly orderAnalytics = computed<OrderAnalytics>(() => this.buildOrderAnalytics(this.orders()));

  readonly hasOrderInsights = computed(
    () =>
      this.orderAnalytics().topByQuantity.length > 0 || this.orderAnalytics().topByRevenue.length > 0,
  );

  readonly discountSummary = computed(() => {
    const now = new Date();
    let active = 0;
    let upcoming = 0;
    let expired = 0;

    for (const discount of this.discounts()) {
      const start = this.parseDate(discount.startDate);
      const end = this.parseDate(discount.endDate);

      if (!start || !end) {
        active++;
        continue;
      }

      if (end.getTime() < now.getTime()) {
        expired++;
      } else if (start.getTime() > now.getTime()) {
        upcoming++;
      } else {
        active++;
      }
    }

    return {
      active,
      upcoming,
      expired,
      total: this.discounts().length,
    };
  });

  readonly latestContacts = computed(() => {
    return this.contacts()
      .slice()
      .sort((a, b) => this.dateTimestamp(b.submittedAt) - this.dateTimestamp(a.submittedAt))
      .slice(0, 5);
  });

  readonly kpiCards = computed<KpiCard[]>(() => {
    const a = this.orderAnalytics();
    const cards: KpiCard[] = [];

    cards.push({
      title: 'Narudžbe danas',
      value: this.ordersError() ? '-' : this.formatInt(a.todayOrders),
      hint: this.ordersError() ?? 'Broj narudžbi za tekući dan',
      tone: 'default',
    });
    cards.push({
      title: 'Narudžbe (mjesec)',
      value: this.ordersError() ? '-' : this.formatInt(a.monthOrders),
      hint: this.ordersError() ?? 'Ukupan broj narudžbi u ovom mjesecu',
      tone: 'default',
    });
    cards.push({
      title: 'Narudžbe (godina)',
      value: this.ordersError() ? '-' : this.formatInt(a.yearOrders),
      hint: this.ordersError() ?? 'Ukupan broj narudžbi u ovoj godini',
      tone: 'default',
    });
    cards.push({
      title: 'Ukupno narudžbi',
      value: this.ordersError() ? '-' : this.formatInt(a.totalOrders),
      hint: this.ordersError() ?? 'Sve učitane narudžbe (od 01.01.2000)',
      tone: 'default',
    });
    cards.push({
      title: 'Prihod (mjesec)',
      value: this.ordersError() ? '-' : this.formatMoney(a.monthRevenue),
      hint: this.ordersError() ?? 'Zbroj `totalPrice` za tekući mjesec',
      tone: 'good',
    });
    cards.push({
      title: 'Prihod (godina)',
      value: this.ordersError() ? '-' : this.formatMoney(a.yearRevenue),
      hint: this.ordersError() ?? 'Zbroj `totalPrice` za tekuću godinu',
      tone: 'good',
    });
    cards.push({
      title: 'Prosječna narudžba',
      value: this.ordersError() ? '-' : this.formatMoneyNullable(a.avgOrderValue),
      hint: this.ordersError() ?? 'Prosječna vrijednost narudžbe',
      tone: 'default',
    });
    cards.push({
      title: 'Najveća narudžba',
      value: this.ordersError() ? '-' : this.formatMoneyNullable(a.largestOrderAmount),
      hint: this.ordersError() ?? 'Najveća zabilježena vrijednost',
      tone: 'good',
    });
    cards.push({
      title: 'Najmanja narudžba',
      value: this.ordersError() ? '-' : this.formatMoneyNullable(a.smallestOrderAmount),
      hint: this.ordersError() ?? 'Najmanja zabilježena vrijednost',
      tone: 'default',
    });
    cards.push({
      title: 'Na čekanju',
      value: this.ordersError() ? '-' : this.formatInt(a.pendingOrders),
      hint: this.ordersError() ?? 'Status PENDING',
      tone: 'warn',
    });
    cards.push({
      title: 'Email potvrđene',
      value: this.ordersError() ? '-' : this.formatInt(a.emailVerifiedOrders),
      hint: this.ordersError() ?? 'Status EMAIL_VERIFIED',
      tone: 'warn',
    });
    cards.push({
      title: 'Završene narudžbe',
      value: this.ordersError() ? '-' : this.formatInt(a.completedOrders),
      hint: this.ordersError() ?? 'Status COMPLETED',
      tone: 'good',
    });
    cards.push({
      title: 'Otkazane narudžbe',
      value: this.ordersError() ? '-' : this.formatInt(a.canceledOrders),
      hint: this.ordersError() ?? 'Status CANCELED',
      tone: 'danger',
    });
    cards.push({
      title: 'Broj artikala',
      value: this.productsError() ? '-' : this.formatInt(this.variantPairs().length),
      hint: this.productsError() ?? '',
      tone: 'default',
    });
    cards.push({
      title: 'Newsletter pretplatnici',
      value:
        this.newsletterError() || this.newsletterTotal() === null
          ? '-'
          : this.formatInt(this.newsletterTotal() ?? 0),
      hint: this.newsletterError() ?? 'Ukupan broj aktivnih pretplatnika',
      tone: 'default',
    });
    cards.push({
      title: 'Kontakt poruke (30 dana)',
      value: this.contactsError() ? '-' : this.formatInt(this.contacts().length),
      hint: this.contactsError() ?? 'Broj poruka u posljednjih 30 dana',
      tone: 'default',
    });
    cards.push({
      title: 'Aktivni kuponi',
      value: this.couponsError() ? '-' : this.formatInt(this.coupons().length),
      hint: this.couponsError() ?? 'Trenutno aktivni kuponi',
      tone: 'default',
    });

    return cards;
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loadOrders();
    this.loadProducts();
    this.loadDiscounts();
    this.loadCoupons();
    this.loadNewsletter();
    this.loadContacts();
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const d = this.parseDate(value);
    if (!d) return value;

    return new Intl.DateTimeFormat('bs-BA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  trackByOrderId(_: number, order: AdminOrder): string {
    return order.orderId;
  }

  trackByMessageIndex(index: number): number {
    return index;
  }

  trackBySubscriberId(_: number, sub: NewsletterSubscription): string | number {
    return sub.id;
  }

  topInsightLabel(item: ProductSalesMetric): string {
    const sku = item.sku ? ` (${item.sku})` : '';
    return `${item.name}${sku}`;
  }

  statusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    return ORDER_STATUS_LABELS[normalized as OrderStatus] ?? normalized;
  }

  statusClass(status: string): string {
    const key = this.normalizeStatus(status);
    if (key === 'COMPLETED') return 'good';
    if (
      key === 'PENDING' ||
      key === 'EMAIL_VERIFIED' ||
      key === 'WAITING_FOR_CUSTOMER_RECONFIRMATION' ||
      key === 'CUSTOMER_RECONFIRMED'
    ) {
      return 'warn';
    }
    if (key === 'CANCELED' || key === 'EXPIRED') return 'danger';
    return 'default';
  }

  orderCustomer(order: AdminOrder): string {
    const fullName = String(order.userDetails?.fullName ?? '').trim();
    if (fullName) return fullName;
    return String(order.userDetails?.email ?? '').trim() || 'Anonimizovan korisnik';
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return this.formatMoney(value);
  }

  private loadOrders(): void {
    this.ordersLoading.set(true);
    this.ordersError.set(null);

    this.ordersApi
      .getByDate('2000-01-01T00:00:00', this.toApiDateTime(new Date()))
      .pipe(
        tap((res) => {
          this.orders.set(res ?? []);
        }),
        catchError((err) => {
          this.orders.set([]);
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled narudžbi.'
              : 'Narudžbe trenutno nisu dostupne.';
          this.ordersError.set(msg);
          return of([]);
        }),
        finalize(() => {
          this.ordersLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private loadProducts(): void {
    this.productsLoading.set(true);
    this.productsError.set(null);
    this.variantPairs.set([]);

    this.productsApi
      .getVariantIdSkuPairs()
      .pipe(
        tap((list) => {
          this.variantPairs.set(
            (list ?? []).filter((item) => !!String(item?.id ?? '').trim() && !!String(item?.sku ?? '').trim()),
          );
        }),
        catchError((err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled modela proizvoda.'
              : 'Modeli proizvoda trenutno nisu dostupni.';
          this.productsError.set(msg);
          return of([] as ProductVariantIdSkuPair[]);
        }),
        finalize(() => {
          this.productsLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private loadDiscounts(): void {
    this.discountsLoading.set(true);
    this.discountsError.set(null);

    this.discountsApi
      .getAll()
      .pipe(
        tap((list) => this.discounts.set(list ?? [])),
        catchError((err) => {
          this.discounts.set([]);
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled popusta.'
              : 'Popusti trenutno nisu dostupni.';
          this.discountsError.set(msg);
          return of([] as DiscountListItem[]);
        }),
        finalize(() => {
          this.discountsLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private loadCoupons(): void {
    this.couponsLoading.set(true);
    this.couponsError.set(null);

    this.couponsApi
      .getActiveCoupons()
      .pipe(
        tap((list) => this.coupons.set(list ?? [])),
        catchError((err) => {
          this.coupons.set([]);
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled kupona.'
              : 'Kuponi trenutno nisu dostupni.';
          this.couponsError.set(msg);
          return of([] as CouponDetails[]);
        }),
        finalize(() => {
          this.couponsLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private loadNewsletter(): void {
    this.newsletterLoading.set(true);
    this.newsletterError.set(null);
    this.newsletterTotal.set(null);
    this.newsletterMonthNew.set(null);
    this.latestSubscribers.set([]);

    this.newsletterApi
      .getActiveSubscriptions({
        page: 0,
        size: 1000,
        sort: 'subscribedAt,desc',
      })
      .pipe(
        tap((page) => {
          const list = (page?.content ?? []).slice();
          const total = Number(page?.totalElements ?? list.length);

          const sortedLatest = list
            .slice()
            .sort((a, b) => this.dateTimestamp(b.subscribedAt) - this.dateTimestamp(a.subscribedAt));

          this.latestSubscribers.set(sortedLatest.slice(0, 5));
          this.newsletterTotal.set(Number.isFinite(total) ? total : list.length);

          // Ako backend vrati sve stavke u jednoj stranici, broj za mjesec je precizan.
          if (total <= list.length) {
            const monthStart = this.startOfMonth(new Date());
            const monthCount = list.filter((item) => {
              const dt = this.parseDate(item.subscribedAt);
              return dt ? dt.getTime() >= monthStart.getTime() : false;
            }).length;
            this.newsletterMonthNew.set(monthCount);
          } else {
            this.newsletterMonthNew.set(null);
          }
        }),
        catchError((err) => {
          this.latestSubscribers.set([]);
          this.newsletterTotal.set(null);
          this.newsletterMonthNew.set(null);

          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled newsletter pretplatnika.'
              : 'Newsletter pretplatnici trenutno nisu dostupni.';
          this.newsletterError.set(msg);

          return of(null);
        }),
        finalize(() => {
          this.newsletterLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private loadContacts(): void {
    this.contactsLoading.set(true);
    this.contactsError.set(null);
    this.contacts.set([]);

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);

    this.contactsApi
      .searchContacts({
        fromDate: from.toISOString(),
        toDate: now.toISOString(),
      })
      .pipe(
        tap((list) => {
          this.contacts.set(list ?? []);
        }),
        catchError((err) => {
          this.contacts.set([]);
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu za pregled kontakt poruka.'
              : 'Kontakt poruke trenutno nisu dostupne.';
          this.contactsError.set(msg);
          return of([] as ContactMessage[]);
        }),
        finalize(() => {
          this.contactsLoading.set(false);
          this.markRefreshedIfIdle();
        }),
      )
      .subscribe();
  }

  private buildOrderAnalytics(orders: AdminOrder[]): OrderAnalytics {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const startLast7 = new Date(startToday);
    startLast7.setDate(startLast7.getDate() - 6);

    let totalRevenue = 0;
    let monthRevenue = 0;
    let yearRevenue = 0;
    let todayOrders = 0;
    let monthOrders = 0;
    let yearOrders = 0;
    let last7DaysOrders = 0;
    let pendingOrders = 0;
    let emailVerifiedOrders = 0;
    let completedOrders = 0;
    let canceledOrders = 0;
    let expiredOrders = 0;
    let ordersWithMissingDate = 0;
    let hasAnyOrderDate = false;

    let largestOrder: AdminOrder | null = null;
    let smallestOrder: AdminOrder | null = null;
    let largestOrderAmount: number | null = null;
    let smallestOrderAmount: number | null = null;
    let priceCount = 0;

    const statusCounter = new Map<string, number>();
    const productCounter = new Map<string, ProductSalesMetric>();

    for (const order of orders) {
      const statusKey = this.normalizeStatus(order.status);
      const isCompleted = statusKey === 'COMPLETED';
      statusCounter.set(statusKey, (statusCounter.get(statusKey) ?? 0) + 1);

      if (statusKey === 'PENDING') pendingOrders++;
      if (statusKey === 'EMAIL_VERIFIED') emailVerifiedOrders++;
      if (statusKey === 'COMPLETED') completedOrders++;
      if (statusKey === 'CANCELED') canceledOrders++;
      if (statusKey === 'EXPIRED') expiredOrders++;

      const amount = this.safeNumber(order.totalPrice);
      if (isCompleted && amount !== null) {
        totalRevenue += amount;
        priceCount += 1;

        if (largestOrderAmount === null || amount > largestOrderAmount) {
          largestOrderAmount = amount;
          largestOrder = order;
        }

        if (smallestOrderAmount === null || amount < smallestOrderAmount) {
          smallestOrderAmount = amount;
          smallestOrder = order;
        }
      }

      const orderDate = this.parseOrderDate(order);
      if (orderDate) {
        hasAnyOrderDate = true;

        if (orderDate.getTime() >= startYear.getTime() && orderDate.getTime() <= now.getTime()) {
          yearOrders += 1;
          if (isCompleted && amount !== null) yearRevenue += amount;
        }

        if (orderDate.getTime() >= startMonth.getTime() && orderDate.getTime() <= now.getTime()) {
          monthOrders += 1;
          if (isCompleted && amount !== null) monthRevenue += amount;
        }

        if (orderDate.getTime() >= startToday.getTime() && orderDate.getTime() <= now.getTime()) {
          todayOrders += 1;
        }

        if (orderDate.getTime() >= startLast7.getTime() && orderDate.getTime() <= now.getTime()) {
          last7DaysOrders += 1;
        }
      } else {
        ordersWithMissingDate += 1;
      }

      if (!isCompleted) continue;

      for (const item of order.items ?? []) {
        const sku = String(item.productSku ?? '').trim();
        const name = String(item.productName ?? '').trim() || 'Nepoznat proizvod';
        const key = sku || name;
        if (!key) continue;

        const current = productCounter.get(key) ?? {
          key,
          name,
          sku,
          quantity: 0,
          revenue: 0,
        };

        const qty = this.safeNumber(item.quantity) ?? 0;
        const itemRevenue = this.safeNumber(item.totalItemPrice) ?? 0;

        current.quantity += qty;
        current.revenue += itemRevenue;
        productCounter.set(key, current);
      }
    }

    const avgOrderValue = priceCount > 0 ? totalRevenue / priceCount : null;

    const latestOrders = orders
      .slice()
      .sort((a, b) => this.orderTimestamp(b) - this.orderTimestamp(a))
      .slice(0, 8);

    const statusMetrics = this.buildStatusMetrics(statusCounter, orders.length);

    const productMetrics = Array.from(productCounter.values());
    const topByQuantity = productMetrics
      .slice()
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);
    const topByRevenue = productMetrics
      .slice()
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
      .slice(0, 5);

    const totalSoldUnits = productMetrics.reduce((sum, item) => sum + item.quantity, 0);

    return {
      totalOrders: orders.length,
      todayOrders,
      monthOrders,
      yearOrders,
      last7DaysOrders,
      totalRevenue,
      monthRevenue,
      yearRevenue,
      avgOrderValue,
      largestOrder,
      largestOrderAmount,
      smallestOrder,
      smallestOrderAmount,
      pendingOrders,
      emailVerifiedOrders,
      completedOrders,
      canceledOrders,
      expiredOrders,
      statusMetrics,
      latestOrders,
      topByQuantity,
      topByRevenue,
      totalSoldUnits,
      ordersWithMissingDate,
      hasAnyOrderDate,
    };
  }

  private buildStatusMetrics(counter: Map<string, number>, totalOrders: number): StatusMetric[] {
    const metrics: StatusMetric[] = [];

    for (const status of ORDER_STATUS_PRIORITY) {
      const key = status;
      const count = counter.get(key) ?? 0;
      metrics.push({
        key,
        label: ORDER_STATUS_LABELS[status],
        count,
        ratio: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
      });
      counter.delete(key);
    }

    for (const [key, count] of counter.entries()) {
      metrics.push({
        key,
        label: key,
        count,
        ratio: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
      });
    }

    return metrics;
  }

  private parseOrderDate(order: AdminOrder): Date | null {
    return this.parseDate(order.orderDate ?? null);
  }

  private parseDate(value: unknown): Date | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private dateTimestamp(value: string | null | undefined): number {
    const d = this.parseDate(value ?? null);
    return d ? d.getTime() : -1;
  }

  private orderTimestamp(order: AdminOrder): number {
    const dt = this.parseOrderDate(order);
    if (dt) return dt.getTime();
    return -1;
  }

  private safeNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private normalizeStatus(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase();
  }

  private formatInt(value: number): string {
    return new Intl.NumberFormat('bs-BA', { maximumFractionDigits: 0 }).format(Math.max(0, value));
  }

  private formatMoney(value: number): string {
    return `${new Intl.NumberFormat('bs-BA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)} KM`;
  }

  private formatMoneyNullable(value: number | null): string {
    if (value === null) return '-';
    return this.formatMoney(value);
  }

  private toApiDateTime(date: Date): string {
    const y = date.getFullYear();
    const m = this.pad(date.getMonth() + 1);
    const d = this.pad(date.getDate());
    const hh = this.pad(date.getHours());
    const mm = this.pad(date.getMinutes());
    const ss = this.pad(date.getSeconds());
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private markRefreshedIfIdle(): void {
    if (!this.anyLoading()) {
      this.lastRefreshedAt.set(new Date());
    }
  }
}
