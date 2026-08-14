import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export const COOKIE_CONSENT_STORAGE_KEY = 'planeta_cookie_consent_v1';
const CONSENT_VERSION = 1;

export interface CookieConsentRecord {
  version: number;
  necessary: true;
  decidedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly consent = signal<CookieConsentRecord | null>(this.readConsent());

  readonly settingsOpen = signal(false);
  readonly hasDecision = computed(() => this.consent() !== null);
  readonly bannerVisible = computed(() => !this.hasDecision() && !this.settingsOpen());

  acceptNecessary(): void {
    const record: CookieConsentRecord = {
      version: CONSENT_VERSION,
      necessary: true,
      decidedAt: new Date().toISOString(),
    };

    this.consent.set(record);
    this.settingsOpen.set(false);
    this.persist(record);
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  private readConsent(): CookieConsentRecord | null {
    if (!this.isBrowser) return null;

    try {
      const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
      if (parsed.version !== CONSENT_VERSION || parsed.necessary !== true) return null;
      if (!parsed.decidedAt || Number.isNaN(Date.parse(parsed.decidedAt))) return null;

      return {
        version: CONSENT_VERSION,
        necessary: true,
        decidedAt: parsed.decidedAt,
      };
    } catch {
      return null;
    }
  }

  private persist(record: CookieConsentRecord): void {
    if (!this.isBrowser) return;

    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Consent remains valid for the current page even if browser storage is unavailable.
    }
  }
}
