// src/app/pages/checkout/checkout.ts
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormControlStatus, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { CartStore } from '../../core/cart/cart.store';
import {
  CreateOrderItemDTO,
  CreateOrderQuoteDTO,
  CreateUnregisteredOrderDTO,
  OrderQuoteCouponType,
  OrderQuoteDTO,
} from '../../core/api/orders.models';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { currencyDisplayLabel } from '../../shared/utils/currency';
import { TurnstileWidgetComponent } from '../../shared/ui/turnstile-widget/turnstile-widget';
import { TurnstileTokenService } from '../../core/security/turnstile-token.service';
import { isTurnstileVerificationError } from '../../core/security/turnstile.interceptor';
import { ProductImageComponent } from '../../shared/ui/product-image/product-image';

const PHONE_REGEX = /^\+?[0-9][0-9\s/-]{5,19}$/;
const POSTAL_CODE_REGEX = /^\d{5}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\p{M}'\-. ]{1,78}[\p{L}\p{M}]$/u;

type QuoteSnapshot = {
  couponCode: string;
  email: string;
  orderItemsKey: string;
};

type AppliedCouponState = {
  code: string;
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
  couponType: OrderQuoteCouponType | null;
  couponValue: number | null;
  snapshot: QuoteSnapshot;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TurnstileWidgetComponent,
    ProductImageComponent,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartStore);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly router = inject(Router);
  readonly turnstile = inject(TurnstileTokenService);

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
  readonly quoteNeedsReapply = signal(false);

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

  readonly originalTotal = computed(() => {
    const base = this.subtotal();
    return {
      amount: this.appliedCoupon()?.subtotal ?? base.amount,
      currency: base.currency,
    };
  });

  readonly discountAmount = computed(() => this.appliedCoupon()?.discountAmount ?? 0);

  readonly total = computed(() => {
    const base = this.subtotal();
    return {
      amount: this.appliedCoupon()?.totalPrice ?? base.amount,
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
      !this.couponApplying() &&
      !this.quoteNeedsReapply() &&
      this.turnstile.hasToken('checkout')
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
      .subscribe((value) => {
        const applied = this.appliedCoupon();
        const currentCode = this.normalizeCouponCode(value);

        if (applied && currentCode !== applied.code) {
          this.invalidateAppliedQuote('Kod kupona je izmijenjen. Ponovo primijenite kupon.');
          return;
        }

        if (!currentCode && !applied) {
          this.quoteNeedsReapply.set(false);
          this.couponFeedback.set(null);
          return;
        }

        if (!applied && !this.quoteNeedsReapply() && !this.couponApplying()) {
          this.couponFeedback.set(null);
        }
      });

    this.form.controls.email.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const applied = this.appliedCoupon();
        if (applied && this.normalizeEmail(value) !== applied.snapshot.email) {
          this.invalidateAppliedQuote('Email je izmijenjen. Ponovo primijenite kupon.');
        }
      });

    effect(() => {
      const orderItemsKey = this.orderItemsKey(this.buildOrderItems());
      const applied = this.appliedCoupon();
      if (applied && orderItemsKey !== applied.snapshot.orderItemsKey) {
        this.invalidateAppliedQuote('Korpa je izmijenjena. Ponovo primijenite kupon.');
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
        if (control.errors?.['required']) return 'Ime i prezime su obavezni.';
        return 'Unesite ispravno ime i prezime.';
      case 'email':
        if (control.errors?.['required']) return 'Email je obavezan.';
        return 'Unesite ispravnu email adresu.';
      case 'phoneNumber':
        if (control.errors?.['required']) return 'Telefon je obavezan.';
        return 'Unesite ispravan broj telefona.';
      case 'address':
        if (control.errors?.['required']) return 'Adresa je obavezna.';
        return 'Unesite ispravnu adresu.';
      case 'municipality':
        if (control.errors?.['required']) return 'Grad je obavezan.';
        if (control.errors?.['minlength'] || control.errors?.['maxlength']) {
          return 'Unesite ispravan naziv grada.';
        }
        return 'Unesite ispravan grad.';
      case 'postalCode':
        if (control.errors?.['required']) return 'Poštanski broj je obavezan.';
        return 'Unesite ispravan poštanski broj (5 cifara).';
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

    const couponCode = this.normalizeCouponCode(this.form.controls.couponCode.value);
    const email = this.normalizeEmail(this.form.controls.email.value);
    this.form.controls.couponCode.markAsTouched();
    this.couponFeedback.set(null);

    if (this.count() <= 0) {
      this.couponFeedback.set({
        kind: 'error',
        text: 'Korpa je prazna. Dodajte proizvode prije primjene kupona.',
      });
      return;
    }

    if (this.form.controls.couponCode.invalid) {
      this.couponFeedback.set({
        kind: 'error',
        text: this.fieldMessage('couponCode') || 'Unesite ispravan kod kupona.',
      });
      return;
    }

    if (!couponCode) {
      this.couponFeedback.set({ kind: 'error', text: 'Unesite kod kupona prije primjene.' });
      return;
    }

    this.form.controls.email.markAsTouched();
    if (!email || this.form.controls.email.invalid) {
      this.couponFeedback.set({
        kind: 'error',
        text: 'Unesite ispravnu email adresu prije primjene kupona.',
      });
      return;
    }

    const alreadyApplied = this.appliedCoupon();
    if (alreadyApplied && this.quoteMatchesCurrentState(alreadyApplied)) {
      this.couponFeedback.set({ kind: 'info', text: 'Kupon je već primijenjen.' });
      return;
    }

    if (!this.turnstile.hasToken('checkout')) {
      this.couponFeedback.set({
        kind: 'error',
        text: 'Potvrdite sigurnosnu provjeru prije primjene kupona.',
      });
      return;
    }

    const orderItems = this.buildOrderItems();
    if (!orderItems.length || !this.areOrderItemsValid(orderItems)) {
      this.couponFeedback.set({
        kind: 'error',
        text: 'Stavke u korpi nisu ispravne. Vratite se u korpu i pokušajte ponovo.',
      });
      return;
    }

    const snapshot = this.createQuoteSnapshot(couponCode, email, orderItems);
    const payload: CreateOrderQuoteDTO = { orderItems, email, couponCode };

    this.appliedCoupon.set(null);
    this.quoteNeedsReapply.set(false);
    this.couponApplying.set(true);

    this.ordersApi
      .createOrderQuote(payload)
      .pipe(
        finalize(() => {
          this.couponApplying.set(false);
          this.turnstile.reset('checkout');
        }),
      )
      .subscribe({
        next: (response) => {
          if (!this.quoteSnapshotMatchesCurrentState(snapshot)) {
            this.couponFeedback.set({
              kind: 'info',
              text: 'Podaci su izmijenjeni. Ponovo primijenite kupon.',
            });
            this.quoteNeedsReapply.set(true);
            return;
          }

          const applied = this.toAppliedCoupon(response, snapshot);
          if (!applied) {
            this.couponFeedback.set({
              kind: 'error',
              text: 'Obračun trenutno nije dostupan. Pokušajte ponovo.',
            });
            return;
          }

          this.appliedCoupon.set(applied);
          this.form.controls.couponCode.setValue(applied.code, { emitEvent: false });
          this.quoteNeedsReapply.set(false);
          this.couponFeedback.set({ kind: 'success', text: 'Kupon je uspješno primijenjen.' });
        },
        error: (error: unknown) => {
          this.appliedCoupon.set(null);
          this.quoteNeedsReapply.set(false);

          if (this.httpStatus(error) === 400) {
            const backendMessage = this.extractBackendMessage(error);
            this.couponFeedback.set({
              kind: 'error',
              text: backendMessage || 'Kupon nije moguće primijeniti na ovu narudžbu.',
            });
            return;
          }

          const message = isTurnstileVerificationError(error)
            ? 'Sigurnosna provjera nije uspjela. Potvrdite je ponovo.'
            : 'Trenutno nije moguće provjeriti kupon. Pokušajte ponovo.';
          this.couponFeedback.set({ kind: 'error', text: message });
        },
      });
  }

  removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.quoteNeedsReapply.set(false);
    this.couponFeedback.set(null);
    this.form.controls.couponCode.setValue('');
    this.form.controls.couponCode.markAsPristine();
    this.form.controls.couponCode.markAsUntouched();
  }

  submit() {
    if (this.submitting()) return;

    this.errorMsg.set(null);

    if (this.count() <= 0) {
      this.errorMsg.set('Korpa je prazna. Dodajte proizvode prije naplate.');
      return;
    }

    const appliedCoupon = this.appliedCoupon();
    if (
      this.quoteNeedsReapply() ||
      (appliedCoupon && !this.quoteMatchesCurrentState(appliedCoupon))
    ) {
      this.invalidateAppliedQuote('Podaci su izmijenjeni. Ponovo primijenite kupon.');
      this.errorMsg.set('Ponovo primijenite kupon ili ga uklonite prije slanja narudžbe.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Molimo vas da popunite sva obavezna polja.');
      return;
    }

    if (!this.turnstile.hasToken('checkout')) {
      this.errorMsg.set('Potvrdite sigurnosnu provjeru prije slanja narudžbe.');
      return;
    }

    const v = this.form.getRawValue();
    const appliedCouponCode = appliedCoupon?.code ?? '';

    const municipality = String(v.municipality ?? '').trim();
    if (!municipality) {
      this.errorMsg.set('Molimo vas da unesete grad dostave.');
      return;
    }

    const coupon = appliedCouponCode;
    const desc = String(v.description ?? '').trim();

    const orderItems = this.buildOrderItems();

    // Hard validation so you never send product/variant ids by mistake
    if (!this.areOrderItemsValid(orderItems)) {
      this.errorMsg.set(
        'Podaci o izabranoj veličini nisu ispravni. Vratite se u korpu i pokušajte ponovo.',
      );
      return;
    }

    const payload: CreateUnregisteredOrderDTO = {
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
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.turnstile.reset('checkout');
        }),
      )
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
          if (isTurnstileVerificationError(err)) {
            this.errorMsg.set('Sigurnosna provjera nije uspjela. Molimo pokušajte ponovo.');
            return;
          }
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
    if (applied.couponType === 'PERCENTAGE' && applied.couponValue !== null) {
      return `${applied.couponValue}%`;
    }
    if (applied.couponType === 'FIXED_AMOUNT' && applied.couponValue !== null) {
      return `${applied.couponValue.toFixed(2)} ${this.currencyLabel(this.subtotal().currency)}`;
    }
    return '';
  }

  private normalizeCouponCode(value: string): string {
    return String(value ?? '').trim();
  }

  private normalizeEmail(value: string): string {
    return String(value ?? '').trim();
  }

  private buildOrderItems(): CreateOrderItemDTO[] {
    return this.items().map((item) => ({
      // CartItem.id is `${sizeVariantAttributeId}::${sizeValue}`. The quote and final order use
      // the same backend size attribute identifier and never use displaySku as an identifier.
      sizeVariantAttributeId: String(item.id).split('::')[0].trim(),
      quantity: item.qty,
    }));
  }

  private areOrderItemsValid(orderItems: CreateOrderItemDTO[]): boolean {
    return (
      orderItems.length > 0 &&
      orderItems.every(
        (item) =>
          !!item.sizeVariantAttributeId &&
          !item.sizeVariantAttributeId.includes('::') &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      )
    );
  }

  private orderItemsKey(orderItems: CreateOrderItemDTO[]): string {
    return JSON.stringify(
      orderItems.map((item) => [item.sizeVariantAttributeId, item.quantity] as const),
    );
  }

  private createQuoteSnapshot(
    couponCode: string,
    email: string,
    orderItems: CreateOrderItemDTO[],
  ): QuoteSnapshot {
    return {
      couponCode,
      email,
      orderItemsKey: this.orderItemsKey(orderItems),
    };
  }

  private quoteSnapshotMatchesCurrentState(snapshot: QuoteSnapshot): boolean {
    return (
      this.normalizeCouponCode(this.form.controls.couponCode.value) === snapshot.couponCode &&
      this.normalizeEmail(this.form.controls.email.value) === snapshot.email &&
      this.orderItemsKey(this.buildOrderItems()) === snapshot.orderItemsKey
    );
  }

  private quoteMatchesCurrentState(applied: AppliedCouponState): boolean {
    return (
      this.quoteSnapshotMatchesCurrentState(applied.snapshot) &&
      applied.code === applied.snapshot.couponCode
    );
  }

  private invalidateAppliedQuote(message: string): void {
    if (!this.appliedCoupon() && this.quoteNeedsReapply()) return;
    this.appliedCoupon.set(null);
    this.quoteNeedsReapply.set(true);
    this.couponFeedback.set({ kind: 'info', text: message });
  }

  private toAppliedCoupon(
    response: OrderQuoteDTO,
    submittedSnapshot: QuoteSnapshot,
  ): AppliedCouponState | null {
    const code = this.normalizeCouponCode(response.couponCode ?? '');
    const subtotal = response.subtotal;
    const discountAmount = response.discountAmount;
    const totalPrice = response.totalPrice;
    const couponType = response.couponType ?? null;
    const couponValue = response.couponValue ?? null;

    if (!code) return null;
    if (
      typeof subtotal !== 'number' ||
      typeof discountAmount !== 'number' ||
      typeof totalPrice !== 'number' ||
      ![subtotal, discountAmount, totalPrice].every(Number.isFinite)
    ) {
      return null;
    }
    if (subtotal < 0 || discountAmount < 0 || totalPrice < 0) return null;
    if (couponType !== null && couponType !== 'PERCENTAGE' && couponType !== 'FIXED_AMOUNT') {
      return null;
    }
    if (
      couponValue !== null &&
      (typeof couponValue !== 'number' || !Number.isFinite(couponValue))
    ) {
      return null;
    }

    return {
      code,
      subtotal,
      discountAmount,
      totalPrice,
      couponType,
      couponValue,
      snapshot: { ...submittedSnapshot, couponCode: code },
    };
  }

  private httpStatus(error: unknown): number {
    if (error instanceof HttpErrorResponse) return error.status;
    return Number((error as { status?: unknown })?.status ?? 0);
  }

  private extractBackendMessage(error: unknown): string {
    const body =
      error instanceof HttpErrorResponse
        ? error.error
        : (error as { error?: unknown } | null | undefined)?.error;
    if (typeof body === 'string') return body.trim();
    if (!body || typeof body !== 'object') return '';

    const record = body as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'title']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
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
}
