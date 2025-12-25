import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';
import {ConfirmDialog} from '../../shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialog],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent {
  cart = inject(CartStore);

  items = this.cart.items;
  count = this.cart.itemsCount;

  subtotal = this.cart.subtotal;
  toFree = this.cart.amountToFreeShipping;
  progress = this.cart.freeShippingProgress;

  total = computed(() => this.subtotal());

  confirmOpen = signal(false);
  private pendingRemoveId = signal<string | null>(null);
  confirmMessage = signal('Da li želite da uklonite ovaj proizvod iz korpe?');

  askRemove(id: string, name?: string) {
    this.pendingRemoveId.set(id);
    this.confirmMessage.set(
      name
        ? `Da li želite da uklonite „${name}“ iz korpe?`
        : 'Da li želite da uklonite ovaj proizvod iz korpe?'
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
