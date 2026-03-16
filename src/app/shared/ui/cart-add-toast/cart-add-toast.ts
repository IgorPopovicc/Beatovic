import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartStore } from '../../../core/cart/cart.store';

const AUTO_CLOSE_MS = 3000;

@Component({
  selector: 'app-cart-add-toast',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart-add-toast.html',
  styleUrl: './cart-add-toast.scss',
})
export class CartAddToastComponent implements OnDestroy {
  private readonly cart = inject(CartStore);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly visible = signal(false);
  readonly title = signal('Proizvod je dodat u korpu');
  readonly subtitle = signal<string | null>(null);

  constructor() {
    effect(() => {
      const evt = this.cart.lastAddEvent();
      if (!evt) return;
      this.open(evt.item.name, evt.item.size ?? null);
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  close(): void {
    this.visible.set(false);
    this.clearTimer();
  }

  onViewCart(): void {
    this.close();
  }

  private open(productName: string, size: string | null): void {
    this.title.set('Proizvod je dodat u korpu');
    this.subtitle.set(this.buildSubtitle(productName, size));
    this.visible.set(true);

    this.clearTimer();
    this.closeTimer = setTimeout(() => {
      this.visible.set(false);
      this.closeTimer = null;
    }, AUTO_CLOSE_MS);
  }

  private buildSubtitle(name: string, size: string | null): string {
    const trimmedName = String(name ?? '').trim();
    const safeName = trimmedName || 'Odabrani proizvod';
    if (size) return `${safeName}, veličina ${size}`;
    return safeName;
  }

  private clearTimer(): void {
    if (!this.closeTimer) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }
}
