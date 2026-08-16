import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  CookieConsentService,
} from '../../../core/privacy/cookie-consent.service';
import { CookieConsentComponent } from './cookie-consent';

describe('CookieConsentComponent', () => {
  let fixture: ComponentFixture<CookieConsentComponent>;
  let consent: CookieConsentService;

  beforeEach(async () => {
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [CookieConsentComponent],
      providers: [
        provideRouter([]),
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    consent = TestBed.inject(CookieConsentService);
    fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
  });

  afterEach(() => window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY));

  it('shows the accurate first-visit notice and accepts necessary storage', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.cookie-banner')).not.toBeNull();
    expect(element.textContent).toContain('Ne koristimo analitičke ni marketinške kolačiće');

    (element.querySelector('.cookie-actions .primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(consent.hasDecision()).toBeTrue();
    expect(element.querySelector('.cookie-banner')).toBeNull();
  });

  it('shows the necessary-only details when settings are reopened', () => {
    consent.acceptNecessary();
    consent.openSettings();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    expect(element.textContent).toContain('korpa u lokalno sačuvanim podacima preglednika');
    expect(element.textContent).toContain('Cloudflare Turnstile');
  });

  it('moves focus into settings and restores it to the opener', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    consent.openSettings();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const closeButton = fixture.nativeElement.querySelector(
      '[aria-label="Zatvori postavke kolačića"]',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(closeButton);

    const saveButton = fixture.nativeElement.querySelector(
      '.settings-actions .primary',
    ) as HTMLButtonElement;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(saveButton);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(closeButton);

    consent.closeSettings();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
