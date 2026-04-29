import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { AdminCouponsApi } from '../../../../core/admin-api/admin-coupons-api';
import { CouponDetails } from '../../../../core/admin-api/admin-coupons.models';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { AdminCouponCreateModal } from './admin-coupon-create-modal/admin-coupon-create-modal';

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule, ConfirmDialog, AdminCouponCreateModal],
  templateUrl: './admin-coupons.html',
  styleUrl: './admin-coupons.scss',
})
export class AdminCoupons {
  private readonly api = inject(AdminCouponsApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly coupons = signal<CouponDetails[]>([]);

  readonly createOpen = signal(false);

  readonly confirmOpen = signal(false);
  readonly confirmBusy = signal(false);
  readonly selectedCoupon = signal<CouponDetails | null>(null);

  readonly hasCoupons = computed(() => this.coupons().length > 0);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getActiveCoupons()
      .pipe(
        tap((list) => {
          const sorted = (list ?? []).slice().sort((a, b) => a.code.localeCompare(b.code));
          this.coupons.set(sorted);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.coupons.set([]);

          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju kupona. Pokušajte ponovo.';

          this.error.set(msg);
          return of([]);
        }),
      )
      .subscribe();
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  onCreated(): void {
    this.createOpen.set(false);
    this.refresh();
  }

  askDeactivate(coupon: CouponDetails): void {
    this.selectedCoupon.set(coupon);
    this.confirmBusy.set(false);
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    if (this.confirmBusy()) return;
    this.confirmOpen.set(false);
    this.selectedCoupon.set(null);
  }

  confirmDeactivate(): void {
    const coupon = this.selectedCoupon();
    if (!coupon || this.confirmBusy()) return;

    this.confirmBusy.set(true);
    this.error.set(null);

    this.api
      .deactivateCoupon(coupon.id)
      .pipe(
        finalize(() => this.confirmBusy.set(false)),
        tap(() => {
          this.confirmOpen.set(false);
          this.selectedCoupon.set(null);
          this.refresh();
        }),
        catchError((err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : err?.status === 404
                ? 'Kupon nije pronađen ili je već deaktiviran.'
                : 'Greška pri deaktivaciji kupona. Pokušajte ponovo.';

          this.error.set(msg);
          return of(null);
        }),
      )
      .subscribe();
  }

  formatDiscount(coupon: CouponDetails): string {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}%`;
    }

    return `${this.formatNumber(coupon.discountValue)} KM`;
  }

  usageLabel(coupon: CouponDetails): string {
    if (coupon.usageType === 'SINGLE_USE') return 'SINGLE_USE';
    if (coupon.usageType === 'PER_USER') return 'PER_USER';
    return coupon.usageType;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('bs-BA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  trackByCouponId(_: number, coupon: CouponDetails): string {
    return coupon.id;
  }
}
