// src/app/pages/cart/cart.ts
import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { currencyDisplayLabel } from '../../shared/utils/currency';
import { ProductImageComponent } from '../../shared/ui/product-image/product-image';
import { CartAvailabilityService } from '../../core/cart/cart-availability.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialog, ProductImageComponent],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent {
  cart = inject(CartStore);
  readonly availability = inject(CartAvailabilityService);
  private router = inject(Router);

  items = this.cart.items;
  count = this.cart.itemsCount;

  subtotal = this.cart.subtotal;
  toFree = this.cart.amountToFreeShipping;
  progress = this.cart.freeShippingProgress;

  total = computed(() => this.subtotal());
  readonly canCheckout = computed(
    () => this.count() > 0 && this.availability.canCheckout(),
  );

  confirmOpen = signal(false);
  private pendingRemoveId = signal<string | null>(null);
  confirmMessage = signal('Želite li ukloniti ovaj proizvod iz korpe?');

  constructor() {
    effect(() => this.availability.scheduleValidation(this.items()));
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
    this.availability.validateNow(this.items()).subscribe({ error: () => undefined });
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
