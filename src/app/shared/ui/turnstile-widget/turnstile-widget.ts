import { isPlatformBrowser } from '@angular/common';
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

@Component({
  selector: 'app-turnstile-widget',
  standalone: true,
  templateUrl: './turnstile-widget.html',
  styleUrl: './turnstile-widget.scss',
})
export class TurnstileWidgetComponent implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokens = inject(TurnstileTokenService);
  private readonly config = inject(RuntimeConfigService);
  private widgetId: string | null = null;
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private renderAttempts = 0;

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

    this.tryRender();
    if (!this.widgetId) {
      this.renderTimer = setInterval(() => this.tryRender(), 100);
    }

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private tryRender(): void {
    if (this.widgetId || !this.container?.nativeElement || !window.turnstile) {
      this.renderAttempts += 1;
      if (this.renderAttempts >= 100) {
        this.statusMessage.set('Sigurnosna provjera trenutno nije dostupna.');
        this.clearRenderTimer();
      }
      return;
    }

    this.widgetId = window.turnstile.render(this.container.nativeElement, {
      sitekey: this.siteKey,
      language: 'bs',
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
    this.clearRenderTimer();
  }

  private cleanup(): void {
    this.clearRenderTimer();
    this.tokens.invalidate(this.context());
    if (this.widgetId && window.turnstile) {
      window.turnstile.remove(this.widgetId);
    }
    this.widgetId = null;
  }

  private clearRenderTimer(): void {
    if (!this.renderTimer) return;
    clearInterval(this.renderTimer);
    this.renderTimer = null;
  }
}
