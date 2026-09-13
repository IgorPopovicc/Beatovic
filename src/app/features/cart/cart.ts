// src/app/pages/cart/cart.ts
import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { currencyDisplayLabel } from '../../shared/utils/currency';
import { ProductImageComponent } from '../../shared/ui/product-image/product-image';
import { TurnstileWidgetComponent } from '../../shared/ui/turnstile-widget/turnstile-widget';
import { CartQuoteService } from '../../core/cart/cart-quote.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialog, ProductImageComponent, TurnstileWidgetComponent],
  providers: [CartQuoteService],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent {
  cart = inject(CartStore);
  readonly quoteService = inject(CartQuoteService);
  private router = inject(Router);

  items = this.cart.items;
  count = this.cart.itemsCount;

  subtotal = computed(() => ({
    amount: this.quoteService.quote()?.subtotal ?? null,
    currency: this.cart.subtotal().currency,
  }));
  total = computed(() => ({ ...this.subtotal(), amount: this.quoteService.quote()?.totalPrice ?? null }));
  toFree = computed(() => ({
    amount: Math.max(0, this.cart.freeShippingThreshold().amount - (this.total().amount ?? 0)),
    currency: this.subtotal().currency,
  }));
  progress = computed(() => {
    const threshold = this.cart.freeShippingThreshold().amount;
    return threshold > 0 ? Math.min(1, (this.total().amount ?? 0) / threshold) : 0;
  });
  readonly canCheckout = computed(
    () => this.count() > 0 && this.quoteService.matches(this.items()),
  );

  confirmOpen = signal(false);
  private pendingRemoveId = signal<string | null>(null);
  confirmMessage = signal('Želite li ukloniti ovaj proizvod iz korpe?');

  constructor() {
    effect(() => {
      const items = this.items();
      untracked(() => this.quoteService.scheduleValidation(items));
    });
  }

  currencyLabel(currency: unknown): string {
    return currencyDisplayLabel(currency);
  }

  goCheckout() {
    if (!this.canCheckout()) return;
    this.router.navigateByUrl('/checkout');
  }

  decrease(id: string): void {
    this.cart.dec(id);
  }

  increase(id: string): void {
    this.cart.inc(id);
  }

  @HostListener('window:focus')
  refreshAvailability(): void {
    if (this.items().length === 0) return;
    this.quoteService.scheduleValidation(this.items());
  }

  askRemove(id: string, name?: string) {
    this.pendingRemoveId.set(id);
    this.confirmMessage.set(
      name
        ? `Želite li ukloniti „${name}“ iz korpe?`
        : 'Želite li ukloniti ovaj proizvod iz korpe?',
    );
    this.confirmOpen.set(true);
  }

  closeConfirm() {
    this.confirmOpen.set(false);
    this.pendingRemoveId.set(null);
  }

  confirmRemove() {
    const id = this.pendingRemoveId();
    if (id) this.cart.remove(id);
    this.closeConfirm();
  }
}
