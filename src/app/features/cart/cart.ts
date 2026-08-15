// src/app/pages/cart/cart.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { currencyDisplayLabel } from '../../shared/utils/currency';
import { ProductImageComponent } from '../../shared/ui/product-image/product-image';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialog, ProductImageComponent],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent {
  cart = inject(CartStore);
  private router = inject(Router);

  items = this.cart.items;
  count = this.cart.itemsCount;

  subtotal = this.cart.subtotal;
  toFree = this.cart.amountToFreeShipping;
  progress = this.cart.freeShippingProgress;

  total = computed(() => this.subtotal());

  confirmOpen = signal(false);
  private pendingRemoveId = signal<string | null>(null);
  confirmMessage = signal('Želite li ukloniti ovaj proizvod iz korpe?');

  currencyLabel(currency: unknown): string {
    return currencyDisplayLabel(currency);
  }

  goCheckout() {
    this.router.navigateByUrl('/checkout');
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
