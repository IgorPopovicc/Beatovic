// src/app/pages/checkout/checkout.ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControlStatus, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { CartStore } from '../../core/cart/cart.store';
import { UnregisteredOrderRequest } from '../../core/admin-api/admin-orders.models';
import { AdminOrdersApi } from '../../core/admin-api/admin-prders-api';
import {
  CheckoutCoupon,
  CheckoutCouponDiscountType,
  CouponsApiService,
} from '../../core/api/coupons-api.service';
import { currencyDisplayLabel } from '../../shared/utils/currency';

const PHONE_REGEX = /^\+?[0-9][0-9\s/-]{5,19}$/;
const POSTAL_CODE_REGEX = /^\d{5}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\p{M}'\-. ]{1,78}[\p{L}\p{M}]$/u;

type AppliedCouponState = {
  code: string;
  discountType: CheckoutCouponDiscountType;
  discountValue: number;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartStore);
  private readonly ordersApi = inject(AdminOrdersApi);
  private readonly couponsApi = inject(CouponsApiService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly items = this.cart.items;
  readonly subtotal = this.cart.subtotal;
  readonly count = this.cart.itemsCount;

  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly deliveryCountry = 'Bosna i Hercegovina';
  readonly couponApplying = signal(false);
  readonly couponFeedback = signal<{ kind: 'error' | 'info' | 'success'; text: string } | null>(
    null,
  );
  readonly appliedCoupon = signal<AppliedCouponState | null>(null);

  private readonly formStatus = signal<FormControlStatus>('INVALID');

  readonly form = this.fb.nonNullable.group({
    fullName: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(80),
        Validators.pattern(NAME_REGEX),
      ],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(PHONE_REGEX)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
    municipality: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_CODE_REGEX)]],
    privacyPolicyAccepted: [false, [Validators.requiredTrue]],

    // optional
    couponCode: ['', [Validators.maxLength(64)]],
    description: ['', [Validators.maxLength(200)]],
  });

  readonly hasAppliedCoupon = computed(() => this.appliedCoupon() !== null);

  readonly discountAmount = computed(() => {
    const applied = this.appliedCoupon();
    if (!applied) return 0;

    const subtotalAmount = Number(this.subtotal().amount ?? 0);
    if (!Number.isFinite(subtotalAmount) || subtotalAmount <= 0) return 0;

    const rawDiscount =
      applied.discountType === 'PERCENTAGE'
        ? subtotalAmount * (applied.discountValue / 100)
        : applied.discountValue;

    if (!Number.isFinite(rawDiscount) || rawDiscount <= 0) return 0;
    return Math.min(this.roundMoney(rawDiscount), this.roundMoney(subtotalAmount));
  });

  readonly total = computed(() => {
    const base = this.subtotal();
    const subtotalAmount = Number(base.amount ?? 0);
    const totalAmount = Math.max(0, this.roundMoney(subtotalAmount - this.discountAmount()));

    return {
      amount: totalAmount,
      currency: base.currency,
    };
  });

  currencyLabel(currency: unknown): string {
    return currencyDisplayLabel(currency);
  }

  readonly canSubmit = computed(() => {
    return (
      this.count() > 0 &&
      this.formStatus() === 'VALID' &&
      !this.submitting() &&
      !this.couponApplying()
    );
  });

  constructor() {
    this.formStatus.set(this.form.status);

    this.form.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => this.formStatus.set(status ?? 'INVALID'));

    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.errorMsg.set(null));

    this.form.controls.couponCode.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.appliedCoupon()) {
          this.couponFeedback.set(null);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.router.navigateByUrl('/cart');
  }

  fieldMessage(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control.touched) return '';
    if (!control.invalid) return '';

    switch (controlName) {
      case 'fullName':
        if (control.errors?.['required']) return 'Ime i prezime je obavezno.';
        return 'Unesi ispravno ime i prezime.';
      case 'email':
        if (control.errors?.['required']) return 'E-mail je obavezan.';
        return 'Unesi ispravan e-mail.';
      case 'phoneNumber':
        if (control.errors?.['required']) return 'Telefon je obavezan.';
        return 'Unesi ispravan broj telefona.';
      case 'address':
        if (control.errors?.['required']) return 'Adresa je obavezna.';
        return 'Unesi ispravnu adresu.';
      case 'municipality':
        if (control.errors?.['required']) return 'Grad je obavezan.';
        if (control.errors?.['minlength'] || control.errors?.['maxlength']) {
          return 'Unesi ispravan naziv grada.';
        }
        return 'Unesi ispravan grad.';
      case 'postalCode':
        if (control.errors?.['required']) return 'Poštanski broj je obavezan.';
        return 'Unesi ispravan poštanski broj (5 cifara).';
      case 'privacyPolicyAccepted':
        return 'Morate prihvatiti politiku privatnosti.';
      case 'couponCode':
        if (control.errors?.['maxlength']) return 'Kupon može imati najviše 64 karaktera.';
        return '';
      case 'description':
        if (control.errors?.['maxlength']) return 'Napomena može imati najviše 200 karaktera.';
        return '';
      default:
        return '';
    }
  }

  hasFieldError(controlName: keyof typeof this.form.controls): boolean {
    return this.fieldMessage(controlName).length > 0;
  }

  helperMessage(controlName: keyof typeof this.form.controls): string {
    if (controlName === 'couponCode') {
      const feedback = this.couponFeedback();
      return feedback?.text ?? '';
    }
    return '';
  }

  helperMessageKind(controlName: keyof typeof this.form.controls): 'error' | 'info' | 'success' | null {
    if (controlName === 'couponCode') {
      return this.couponFeedback()?.kind ?? null;
    }
    return null;
  }

  applyCoupon(): void {
    if (this.couponApplying() || this.submitting()) return;

    const rawCode = this.normalizeCouponCode(this.form.controls.couponCode.value);
    this.form.controls.couponCode.markAsTouched();
    this.couponFeedback.set(null);

    if (this.form.controls.couponCode.invalid) {
      this.couponFeedback.set({
        kind: 'error',
        text: this.fieldMessage('couponCode') || 'Unesi ispravan kod kupona.',
      });
      return;
    }

    if (!rawCode) {
      this.couponFeedback.set({ kind: 'error', text: 'Unesi kod kupona prije primjene.' });
      return;
    }

    const alreadyApplied = this.appliedCoupon();
    if (alreadyApplied && this.normalizeCouponCode(alreadyApplied.code) === rawCode) {
      this.couponFeedback.set({ kind: 'info', text: 'Kupon je već primijenjen.' });
      return;
    }

    this.couponApplying.set(true);

    this.couponsApi
      .lookupCouponByCode(rawCode)
      .pipe(finalize(() => this.couponApplying.set(false)))
      .subscribe((result) => {
        if (result.status === 'valid') {
          this.setAppliedCouponFromActiveList(result.coupon);
          return;
        }

        this.appliedCoupon.set(null);

        if (result.status === 'exhausted') {
          this.couponFeedback.set({
            kind: 'error',
            text: 'Kupon je iskorišten ili više nije dostupan.',
          });
          return;
        }

        if (result.status === 'not_found') {
          this.couponFeedback.set({
            kind: 'error',
            text: 'Kupon nije važeći.',
          });
          return;
        }

        const message =
          result.status === 'auth_protected'
            ? 'Validacija kupona trenutno nije dostupna. Pokušajte kasnije.'
            : 'Trenutno nije moguće provjeriti kupon. Pokušajte ponovo.';

        this.couponFeedback.set({
          kind: 'error',
          text: message,
        });
      });
  }

  removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponFeedback.set(null);
    this.form.controls.couponCode.setValue('');
    this.form.controls.couponCode.markAsPristine();
    this.form.controls.couponCode.markAsUntouched();
  }

  submit() {
    if (this.submitting()) return;

    this.errorMsg.set(null);

    if (this.count() <= 0) {
      this.errorMsg.set('Korpa je prazna. Dodaj proizvode prije naplate.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Molimo popuni sva obavezna polja.');
      return;
    }

    const v = this.form.getRawValue();
    const appliedCoupon = this.appliedCoupon();
    const appliedCouponCode = appliedCoupon ? this.normalizeCouponCode(appliedCoupon.code) : '';

    const municipality = String(v.municipality ?? '').trim();
    if (!municipality) {
      this.errorMsg.set('Molimo unesi grad dostave.');
      return;
    }

    const coupon = appliedCouponCode;
    const desc = String(v.description ?? '').trim();

    const orderItems = this.items().map((it) => {
      // CartItem.id is `${sizeVariantAttributeId}::${sizeValue}`
      const sizeVariantAttributeId = String(it.id).split('::')[0].trim();
      return { sizeVariantAttributeId, quantity: it.qty };
    });

    // Hard validation so you never send product/variant ids by mistake
    if (
      orderItems.some((x) => !x.sizeVariantAttributeId || x.sizeVariantAttributeId.includes('::'))
    ) {
      this.errorMsg.set('Neispravan ID veličine u korpi. (Očekuje se attributes[].id za VELICINA)');
      return;
    }

    const payload: UnregisteredOrderRequest = {
      userDetails: {
        email: String(v.email ?? '').trim(),
        fullName: String(v.fullName ?? '').trim(),
        phoneNumber: String(v.phoneNumber ?? '').trim(),
        address: String(v.address ?? '').trim(),
        municipality,
        postalCode: String(v.postalCode ?? '').trim(),
        privacyPolicyAccepted: true,
      },
      orderItems,
      ...(coupon ? { couponCode: coupon } : {}),
      ...(desc ? { description: desc } : {}),
    };

    this.submitting.set(true);

    this.ordersApi
      .createUnregisteredOrder(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (res) => {
          // CLEAR CART ONLY ON SUCCESS
          this.cart.clear();

          this.router.navigate(['/order-result'], {
            queryParams: { status: 'success' },
            state: {
              status: 'success',
              email: payload.userDetails.email,
              response: res,
            },
          });
        },
        error: (err) => {
          const couponError = this.extractCouponErrorMessage(err);
          if (couponError) {
            this.errorMsg.set(couponError);
            this.couponFeedback.set({ kind: 'error', text: couponError });
            return;
          }

          const userMsg = 'Trenutno nismo uspjeli poslati narudžbu. Molimo pokušajte ponovo.';
          this.errorMsg.set(userMsg);

          this.router.navigate(['/order-result'], {
            queryParams: { status: 'error' },
            state: {
              status: 'error',
              email: payload.userDetails.email,
              error: userMsg,
            },
          });
        },
      });
  }

  discountLabel(): string {
    const applied = this.appliedCoupon();
    if (!applied) return '';
    if (applied.discountType === 'PERCENTAGE') {
      return `${applied.discountValue}%`;
    }
    if (applied.discountType === 'FIXED_AMOUNT') {
      return `${this.roundMoney(applied.discountValue).toFixed(2)} ${this.currencyLabel(this.subtotal().currency)}`;
    }
    return '';
  }

  private setAppliedCouponFromActiveList(coupon: CheckoutCoupon): void {
    this.appliedCoupon.set({
      code: coupon.code.trim(),
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
    });
    this.form.controls.couponCode.setValue(coupon.code.trim());
    this.couponFeedback.set({ kind: 'success', text: 'Kupon je uspješno primijenjen.' });
  }

  private normalizeCouponCode(value: string): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private extractCouponErrorMessage(err: unknown): string | null {
    const status = Number((err as { status?: unknown })?.status ?? 0);
    const message = this.flattenErrorMessage((err as { error?: unknown })?.error).toLowerCase();
    const containsCouponSignal = message.includes('coupon') || message.includes('kupon');
    if (!containsCouponSignal) return null;

    if (message.includes('expired') || message.includes('istek')) {
      return 'Kupon je istekao.';
    }

    if (message.includes('inactive') || message.includes('not active') || message.includes('neakt')) {
      return 'Kupon trenutno nije aktivan.';
    }

    if (message.includes('already used') || message.includes('already been used') || message.includes('iskori')) {
      return 'Kupon je već iskorišten.';
    }

    if (message.includes('not applicable') || message.includes('nije primjenjiv')) {
      return 'Kupon nije primjenjiv na ovu narudžbu.';
    }

    if (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('nije pronađen')
    ) {
      return 'Kupon nije važeći.';
    }

    if (status === 400 || status === 409 || status === 422) {
      return 'Kupon nije važeći, istekao je, već je iskorišten ili nije primjenjiv na ovu narudžbu.';
    }

    return 'Kupon trenutno nije moguće primijeniti. Uklonite kupon i pokušajte ponovo.';
  }

  private flattenErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';

    const values = Object.values(error as Record<string, unknown>);
    return values
      .map((value) => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.join(' ');
        if (value && typeof value === 'object') return JSON.stringify(value);
        return String(value ?? '');
      })
      .join(' ');
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}
