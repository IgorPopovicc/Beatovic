import { isPlatformBrowser, Location } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

const HISTORY_KEY = 'beatovicBackV1';

/** A marker on each native entry, never a second history stack or a saved listing URL. */
@Injectable({ providedIn: 'root' })
export class BackNavigationService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private initialized = false;
  private start: NavigationStart | null = null;
  private previousPath = '';

  private readonly backAvailable = signal(false);
  private readonly navigating = signal(false);
  private readonly path = signal('');
  readonly canGoBack = this.backAvailable.asReadonly();
  readonly pending = this.navigating.asReadonly();

  constructor() {
    if (!this.browser) return;

    // Read before Angular replaces state during initial navigation. This survives refresh.
    this.path.set(this.location.path(true) || '/');
    this.backAvailable.set(this.readMarker(this.location.getState()));
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.start = event;
        this.previousPath = this.location.path(true) || '/';
        this.navigating.set(true);
      } else if (event instanceof NavigationEnd) {
        const extras = this.router.currentNavigation()?.extras;
        if (!extras?.skipLocationChange) {
          let canGoBack = this.canGoBack();
          if (this.start?.navigationTrigger === 'popstate') {
            canGoBack = this.readMarker(this.start.restoredState);
          } else if (
            this.initialized &&
            !extras?.replaceUrl &&
            this.previousPath !== (this.location.path(true) || '/')
          ) {
            canGoBack = this.isStorefrontUrl(this.previousPath);
          }

          this.backAvailable.set(canGoBack);
          this.path.set(this.location.path(true) || '/');
          // Preserve router navigationId, page ID and existing RouterLink state.
          this.location.replaceState(this.location.path(true), '', {
            ...(this.location.getState() as Record<string, unknown>),
            [HISTORY_KEY]: canGoBack,
          });
        }
        this.initialized = true;
        this.start = null;
        this.navigating.set(false);
      } else if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        this.start = null;
        this.navigating.set(false);
      }
    });
  }

  canNavigate(fallback: string | null): boolean {
    return this.canGoBack() || this.validFallback(fallback);
  }

  back(fallback: string | null = '/products'): void {
    if (!this.browser || this.pending() || !this.canNavigate(fallback)) return;
    this.navigating.set(true);
    if (this.canGoBack()) {
      this.location.back();
    } else if (fallback) {
      // Replace a direct-entry detail page so Back cannot bounce between it and the fallback.
      void this.router
        .navigateByUrl(fallback, { replaceUrl: true })
        .finally(() => {
          this.navigating.set(false);
        })
        .catch(() => undefined);
    }
  }

  private validFallback(fallback: string | null): boolean {
    return !!fallback && this.isStorefrontUrl(fallback) && fallback !== this.path();
  }

  private readMarker(state: unknown): boolean {
    return (
      !!state &&
      typeof state === 'object' &&
      (state as Record<string, unknown>)[HISTORY_KEY] === true
    );
  }

  private isStorefrontUrl(url: string): boolean {
    // Transaction outcomes, email actions, admin and unknown routes are not return destinations.
    const path = url.split(/[?#]/, 1)[0];
    return /^(?:\/|\/(?:products|brands|cart|checkout|politika-privatnosti)\/?|\/product\/[^/]+|\/catalog(?:\/[^/]+){1,3})$/.test(
      path,
    );
  }
}
