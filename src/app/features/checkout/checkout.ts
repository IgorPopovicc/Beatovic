// src/app/pages/checkout/checkout.ts
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { CartStore } from '../../core/cart/cart.store';
import { UnregisteredOrderRequest } from '../../core/admin-api/admin-orders.models';
import { AdminOrdersApi } from '../../core/admin-api/admin-prders-api';

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
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  items = this.cart.items;
  subtotal = this.cart.subtotal;
  count = this.cart.itemsCount;

  submitting = signal(false);
  errorMsg = signal<string | null>(null);

  private formStatus = signal<'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'>('INVALID');

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.minLength(6)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    municipality: ['', [Validators.required, Validators.minLength(2)]],
    postalCode: ['', [Validators.required, Validators.minLength(3)]],

    // optional
    couponCode: ['', [Validators.maxLength(64)]],
    description: ['', [Validators.maxLength(200)]],
  });

  total = computed(() => this.subtotal());

  canSubmit = computed(() => {
    return this.count() > 0 && this.formStatus() === 'VALID' && !this.submitting();
  });

  constructor() {
    this.formStatus.set(this.form.status as any);

    this.form.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => this.formStatus.set((s as any) ?? 'INVALID'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.router.navigateByUrl('/cart');
  }

  submit() {
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

    const coupon = String(v.couponCode ?? '').trim();
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
        municipality: String(v.municipality ?? '').trim(),
        postalCode: String(v.postalCode ?? '').trim(),
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
        error: (_err) => {
          const userMsg = 'Trenutno nismo uspjeli poslati porudžbinu. Molimo pokušajte ponovo.';
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
}
