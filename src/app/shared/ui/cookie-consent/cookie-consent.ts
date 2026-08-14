import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../../core/privacy/cookie-consent.service';

@Component({
  selector: 'app-cookie-consent',
  imports: [RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.scss',
})
export class CookieConsentComponent {
  readonly consent = inject(CookieConsentService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private focusOrigin: HTMLElement | null = null;
  private settingsWereOpen = false;

  @ViewChild('settingsClose') private settingsClose?: ElementRef<HTMLButtonElement>;

  private readonly settingsFocusEffect = effect(() => {
    const settingsOpen = this.consent.settingsOpen();
    if (!this.isBrowser || settingsOpen === this.settingsWereOpen) return;
    this.settingsWereOpen = settingsOpen;

    if (settingsOpen) {
      const activeElement = this.document.activeElement;
      this.focusOrigin = activeElement instanceof HTMLElement ? activeElement : null;
      setTimeout(() => this.settingsClose?.nativeElement.focus(), 0);
      return;
    }

    const focusOrigin = this.focusOrigin;
    this.focusOrigin = null;
    if (focusOrigin?.isConnected) setTimeout(() => focusOrigin.focus(), 0);
  });

  acceptNecessary(): void {
    this.consent.acceptNecessary();
  }

  openSettings(): void {
    this.consent.openSettings();
  }

  closeSettings(): void {
    this.consent.closeSettings();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.consent.settingsOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSettings();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = this.settingsClose?.nativeElement.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden'));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = this.document.activeElement;
    if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
}
