import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeConfigService } from '../../../core/config/runtime-config.service';
import {
  TurnstileContext,
  TurnstileTokenService,
} from '../../../core/security/turnstile-token.service';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      theme: 'auto';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(document: Document): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const loaded = (): void => resolve();
    const failed = (): void => {
      turnstileScriptPromise = null;
      reject(new Error('Cloudflare Turnstile script failed to load.'));
    };

    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}

@Component({
  selector: 'app-turnstile-widget',
  standalone: true,
  templateUrl: './turnstile-widget.html',
  styleUrl: './turnstile-widget.scss',
})
export class TurnstileWidgetComponent implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokens = inject(TurnstileTokenService);
  private readonly config = inject(RuntimeConfigService);
  private widgetId: string | null = null;
  private destroyed = false;

  readonly context = input.required<TurnstileContext>();
  readonly statusMessage = signal<string | null>(null);
  readonly siteKey = this.config.turnstileSiteKey;

  @ViewChild('container', { static: true })
  private container?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.tokens.resetRequests$
      .pipe(
        filter((context) => context === this.context()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.widgetId && window.turnstile) {
          window.turnstile.reset(this.widgetId);
        }
      });

    if (!this.siteKey) {
      this.statusMessage.set('Sigurnosna provjera nije konfigurisana.');
      return;
    }

    void loadTurnstileScript(this.document)
      .then(() => this.tryRender())
      .catch(() => {
        if (!this.destroyed) {
          this.statusMessage.set('Sigurnosna provjera trenutno nije dostupna.');
        }
      });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.cleanup();
    });
  }

  private tryRender(): void {
    if (this.destroyed || this.widgetId || !this.container?.nativeElement) return;
    if (!window.turnstile) {
      this.statusMessage.set('Sigurnosna provjera trenutno nije dostupna.');
      return;
    }

    this.widgetId = window.turnstile.render(this.container.nativeElement, {
      sitekey: this.siteKey,
      // Turnstile does not support the `bs` locale. Croatian keeps the security UI in the same
      // Latin-script language family and avoids the widget's English fallback warning.
      language: 'hr',
      theme: 'auto',
      callback: (token) => {
        this.statusMessage.set(null);
        this.tokens.setToken(this.context(), token);
      },
      'expired-callback': () => {
        this.tokens.invalidate(this.context());
        this.statusMessage.set('Sigurnosna provjera je istekla. Potvrdite je ponovo.');
      },
      'error-callback': () => {
        this.tokens.invalidate(this.context());
        this.statusMessage.set('Sigurnosna provjera nije uspjela. Molimo pokušajte ponovo.');
      },
    });
  }

  private cleanup(): void {
    this.tokens.invalidate(this.context());
    if (this.widgetId && window.turnstile) {
      window.turnstile.remove(this.widgetId);
    }
    this.widgetId = null;
  }
}
