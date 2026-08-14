import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COOKIE_CONSENT_STORAGE_KEY, CookieConsentService } from './cookie-consent.service';

describe('CookieConsentService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        CookieConsentService,
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  afterEach(() => {
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  });

  it('shows the notice on a first visit and persists a necessary-only decision', () => {
    const service = TestBed.inject(CookieConsentService);
    expect(service.bannerVisible()).toBeTrue();

    service.acceptNecessary();

    expect(service.bannerVisible()).toBeFalse();
    const persisted = JSON.parse(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) ?? '{}',
    ) as Record<string, unknown>;
    expect(persisted['version']).toBe(1);
    expect(persisted['necessary']).toBeTrue();
    expect(persisted['decidedAt']).toEqual(jasmine.any(String));
  });

  it('recognizes a valid decision for a returning visitor', () => {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 1, necessary: true, decidedAt: new Date().toISOString() }),
    );

    const service = TestBed.inject(CookieConsentService);

    expect(service.hasDecision()).toBeTrue();
    expect(service.bannerVisible()).toBeFalse();
  });

  it('reopens and closes the settings independently of a saved decision', () => {
    const service = TestBed.inject(CookieConsentService);
    service.acceptNecessary();

    service.openSettings();
    expect(service.settingsOpen()).toBeTrue();

    service.closeSettings();
    expect(service.settingsOpen()).toBeFalse();
    expect(service.hasDecision()).toBeTrue();
  });
});
