import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartStore } from '../../../core/cart/cart.store';
import { AppNotice, AppNoticeService } from '../../../core/system/app-notice.service';

const AUTO_CLOSE_MS = 3000;
const EXIT_ANIMATION_MS = 180;

@Component({
  selector: 'app-cart-add-toast',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart-add-toast.html',
  styleUrl: './cart-add-toast.scss',
})
export class CartAddToastComponent implements OnDestroy {
  private readonly cart = inject(CartStore);
  private readonly notices = inject(AppNoticeService);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private unmountTimer: ReturnType<typeof setTimeout> | null = null;

  readonly rendered = signal(false);
  readonly visible = signal(false);
  readonly kind = signal<'success' | 'error' | 'info'>('success');
  readonly action = signal<'cart' | 'none'>('none');
  readonly title = signal('Proizvod je dodan u korpu');
  readonly subtitle = signal<string | null>(null);
  readonly icon = computed(() => {
    switch (this.kind()) {
      case 'error':
        return '!';
      case 'info':
        return 'i';
      default:
        return '✓';
    }
  });

  constructor() {
    effect(() => {
      const evt = this.cart.lastAddEvent();
      if (!evt) return;
      this.openCartToast(evt.item.name, evt.item.size ?? null);
    });

    effect(() => {
      const notice = this.notices.lastNotice();
      if (!notice) return;
      this.openNoticeToast(notice);
    });
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
    this.clearUnmountTimer();
  }

  close(): void {
    this.hideToast();
  }

  onViewCart(): void {
    this.close();
  }

  private openCartToast(productName: string, size: string | null): void {
    this.kind.set('success');
    this.action.set('cart');
    this.title.set('Proizvod je dodan u korpu');
    this.subtitle.set(this.buildSubtitle(productName, size));
    this.showToast();
  }

  private openNoticeToast(notice: AppNotice): void {
    this.kind.set(notice.kind);
    this.action.set('none');
    this.title.set(notice.title || 'Obavještenje');
    this.subtitle.set(notice.subtitle ?? null);
    this.showToast();
  }

  private showToast(): void {
    this.rendered.set(true);
    this.clearUnmountTimer();
    this.deferShow();

    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.hideToast();
      this.closeTimer = null;
    }, AUTO_CLOSE_MS);
  }

  private buildSubtitle(name: string, size: string | null): string {
    const trimmedName = String(name ?? '').trim();
    const safeName = trimmedName || 'Odabrani proizvod';
    if (size) return `${safeName}, veličina ${size}`;
    return safeName;
  }

  private hideToast(): void {
    this.visible.set(false);
    this.clearCloseTimer();
    this.scheduleUnmount();
  }

  private deferShow(): void {
    this.runNextFrame(() => this.visible.set(true));
  }

  private scheduleUnmount(): void {
    this.clearUnmountTimer();
    this.unmountTimer = setTimeout(() => {
      if (!this.visible()) {
        this.rendered.set(false);
      }
      this.unmountTimer = null;
    }, EXIT_ANIMATION_MS);
  }

  private runNextFrame(work: () => void): void {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => work());
      return;
    }
    setTimeout(work, 0);
  }

  private clearCloseTimer(): void {
    if (!this.closeTimer) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private clearUnmountTimer(): void {
    if (!this.unmountTimer) return;
    clearTimeout(this.unmountTimer);
    this.unmountTimer = null;
  }
}
