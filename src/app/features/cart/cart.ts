import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
}
