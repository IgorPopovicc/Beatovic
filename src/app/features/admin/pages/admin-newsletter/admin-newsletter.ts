import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { AdminNewsletterApi } from '../../../../core/admin-api/admin-newsletter-api';
import {
  NewsletterSubscription,
  NewsletterSubscriptionsQuery,
  PagedResult,
} from '../../../../core/admin-api/admin-newsletter.models';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';

const PAGE_SIZE = 20;
const DEFAULT_SORT = 'subscribedAt,desc';

@Component({
  selector: 'app-admin-newsletter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-newsletter.html',
  styleUrl: './admin-newsletter.scss',
})
export class AdminNewsletter {
  private readonly api = inject(AdminNewsletterApi);

  readonly search = new FormControl<string>('', { nonNullable: true });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly pageData = signal<PagedResult<NewsletterSubscription>>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: PAGE_SIZE,
    numberOfElements: 0,
    first: true,
    last: true,
    empty: true,
  });

  readonly page = signal(0);

  readonly items = computed(() => this.pageData().content);
  readonly hasItems = computed(() => this.items().length > 0);
  readonly pageNumberUi = computed(() => this.pageData().number + 1);
  readonly totalPagesUi = computed(() => Math.max(this.pageData().totalPages, 1));
  readonly canGoPrev = computed(() => !this.loading() && !this.pageData().first && this.page() > 0);
  readonly canGoNext = computed(
    () => !this.loading() && !this.pageData().last && this.page() + 1 < this.totalPagesUi(),
  );

  ngOnInit(): void {
    this.fetchPage(0);
  }

  onSearch(): void {
    this.fetchPage(0);
  }

  clearSearch(): void {
    this.search.setValue('');
    this.fetchPage(0);
  }

  goPrev(): void {
    if (!this.canGoPrev()) return;
    this.fetchPage(this.page() - 1);
  }

  goNext(): void {
    if (!this.canGoNext()) return;
    this.fetchPage(this.page() + 1);
  }

  formatDateTime(value: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('bs-BA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  trackBySubscriptionId(_: number, item: NewsletterSubscription): string | number {
    return item.id;
  }

  private fetchPage(page: number): void {
    this.loading.set(true);
    this.error.set(null);

    const q = String(this.search.value ?? '').trim();

    const query: NewsletterSubscriptionsQuery = {
      page: Math.max(0, page),
      size: PAGE_SIZE,
      sort: DEFAULT_SORT,
      ...(q ? { q } : {}),
    };

    this.api
      .getActiveSubscriptions(query)
      .pipe(
        tap((result) => {
          this.pageData.set(result);
          this.page.set(result.number);
        }),
        catchError((err) => {
          this.pageData.set({
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: 0,
            size: PAGE_SIZE,
            numberOfElements: 0,
            first: true,
            last: true,
            empty: true,
          });

          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju newsletter pretplatnika. Pokušajte ponovo.';

          this.error.set(msg);
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }
}
