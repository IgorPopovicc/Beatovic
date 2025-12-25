import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export class BrowserStorage {
  private readonly platformId = inject(PLATFORM_ID);
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get(key: string): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(key);
  }
}
