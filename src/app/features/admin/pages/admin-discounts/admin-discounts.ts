import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { AdminDiscountUpsertModal } from './admin-discount-upsert-modal/admin-discount-upsert-modal';
import {AdminDiscountsApi} from '../../../../core/admin-api/admin-discount-api';
import {ConfirmDialog} from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import {DiscountListItem} from '../../../../core/admin-api/admin-discount.model';


@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [CommonModule, AdminDiscountUpsertModal, ConfirmDialog],
  templateUrl: './admin-discounts.html',
  styleUrl: './admin-discounts.scss',
})
export class AdminDiscounts {
  private readonly api = inject(AdminDiscountsApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly discounts = signal<DiscountListItem[]>([]);

  // modal state
  readonly upsertOpen = signal(false);
  readonly editing = signal<DiscountListItem | null>(null);

  // confirm delete
  readonly confirmOpen = signal(false);
  readonly confirmBusy = signal(false);
  readonly toDelete = signal<DiscountListItem | null>(null);

  readonly hasDiscounts = computed(() => this.discounts().length > 0);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getAll().pipe(
      tap((res) => {
        const list = (res ?? []).slice().sort((a, b) => {
          // newest first (by startDate)
          return String(b.startDate).localeCompare(String(a.startDate));
        });
        this.discounts.set(list);
        this.loading.set(false);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.discounts.set([]);

        const msg =
          err?.status === 401 || err?.status === 403
            ? 'Nemate dozvolu (provjeri admin token / role).'
            : 'Greška pri učitavanju popusta. Pokušajte ponovo.';
        this.error.set(msg);

        return of([]);
      }),
    ).subscribe();
  }

  add(): void {
    this.editing.set(null);
    this.upsertOpen.set(true);
  }

  edit(d: DiscountListItem): void {
    this.editing.set(d);
    this.upsertOpen.set(true);
  }

  closeUpsert(): void {
    this.upsertOpen.set(false);
    this.editing.set(null);
  }

  onSaved(): void {
    this.closeUpsert();
    this.refresh();
  }

  askDelete(d: DiscountListItem): void {
    this.toDelete.set(d);
    this.confirmOpen.set(true);
    this.confirmBusy.set(false);
  }

  cancelDelete(): void {
    if (this.confirmBusy()) return;
    this.confirmOpen.set(false);
    this.toDelete.set(null);
  }

  confirmDelete(): void {
    const d = this.toDelete();
    if (!d) return;

    this.confirmBusy.set(true);
    this.error.set(null);

    this.api.delete(d.id).pipe(
      finalize(() => this.confirmBusy.set(false)),
      tap(() => {
        this.confirmOpen.set(false);
        this.toDelete.set(null);
        this.refresh();
      }),
      catchError((err) => {
        const msg =
          err?.status === 401 || err?.status === 403
            ? 'Nemate dozvolu (provjeri admin token / role).'
            : 'Greška pri brisanju popusta. Pokušajte ponovo.';
        this.error.set(msg);
        return of(null);
      }),
    ).subscribe();
  }

  typeLabel(type: string): string {
    if (type === 'PERCENTAGE') return 'PERCENTAGE';
    if (type === 'FIXED_AMOUNT') return 'FIXED_AMOUNT';
    return type;
  }

  valueLabel(d: DiscountListItem): string {
    return d.type === 'PERCENTAGE' ? `${d.value}%` : `${this.formatPrice(d.value)} RSD`;
  }

  formatPrice(v: number): string {
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('sr-RS', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  trackById(_: number, d: DiscountListItem): string {
    return d.id;
  }
}
