import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { startWith } from 'rxjs';

import { AdminCouponsApi } from '../../../../../core/admin-api/admin-coupons-api';
import {
  CouponDiscountType,
  CouponUsageType,
  CreateCouponRequest,
} from '../../../../../core/admin-api/admin-coupons.models';

@Component({
  selector: 'app-admin-coupon-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-coupon-create-modal.html',
  styleUrl: './admin-coupon-create-modal.scss',
})
export class AdminCouponCreateModal {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminCouponsApi);

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    code: this.fb.nonNullable.control('', [Validators.required]),
    discountType: this.fb.control<CouponDiscountType | null>('PERCENTAGE', [Validators.required]),
    discountValue: this.fb.nonNullable.control<number>(1, [Validators.required, Validators.min(0.01)]),
    usageType: this.fb.control<CouponUsageType | null>('GLOBAL_LIMIT', [Validators.required]),
    maxUsageCount: this.fb.nonNullable.control<number>(1, [Validators.required, Validators.min(1)]),
  });

  private readonly statusSig = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), {
    initialValue: this.form.status,
  });

  readonly discountTypeSig = toSignal(
    this.form.controls.discountType.valueChanges.pipe(startWith(this.form.controls.discountType.value)),
    { initialValue: this.form.controls.discountType.value },
  );

  readonly isPercentage = computed(() => this.discountTypeSig() === 'PERCENTAGE');

  readonly invalid = computed(() => {
    return this.statusSig() === 'INVALID' || this.submitting() || this.maxUsageInvalid();
  });

  ngOnInit(): void {
    this.applyDiscountValueValidators(this.form.controls.discountType.value);

    this.form.controls.discountType.valueChanges.subscribe((value) => {
      this.applyDiscountValueValidators(value);
      this.form.controls.discountValue.updateValueAndValidity({ emitEvent: true });
    });
  }

  onOverlayMouseDown(): void {
    this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  submit(): void {
    this.error.set(null);

    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const maxUsage = Math.floor(Number(raw.maxUsageCount));

    const payload: CreateCouponRequest = {
      code: String(raw.code ?? '').trim(),
      discountType: raw.discountType!,
      discountValue: Number(raw.discountValue),
      usageType: raw.usageType!,
      maxUsageCount: maxUsage,
    };

    if (!payload.code) {
      this.error.set('Kod kupona je obavezan.');
      return;
    }

    this.submitting.set(true);

    this.api
      .createCoupon(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.saved.emit();
          this.close();
        },
        error: (err) => {
          const msg =
            err?.status === 409
              ? 'Kod kupona već postoji. Izaberite drugi kod.'
              : err?.status === 400
                ? 'Validacija nije prošla. Provjerite polja i pokušajte ponovo.'
                : err?.status === 401 || err?.status === 403
                  ? 'Nemate dozvolu (provjeri admin token / role).'
                  : 'Greška pri kreiranju kupona. Pokušajte ponovo.';

          this.error.set(msg);
        },
      });
  }

  maxUsageInvalid(): boolean {
    const value = Number(this.form.controls.maxUsageCount.value);
    if (!Number.isFinite(value)) return true;
    if (!Number.isInteger(value)) return true;
    return value < 1;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }

  private applyDiscountValueValidators(discountType: CouponDiscountType | null): void {
    const control = this.form.controls.discountValue;
    const validators = [Validators.required, Validators.min(0.01)];

    if (discountType === 'PERCENTAGE') {
      validators.push(Validators.max(100));
    }

    control.setValidators(validators);
  }
}
