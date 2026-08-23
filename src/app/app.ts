import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { Navbar } from './shared/ui/navbar/navbar';
import { Footer } from './shared/ui/footer/footer';
import { BackendStatusService } from './core/system/backend-status.service';
import { BackendFallbackComponent } from './features/backend-fallback/backend-fallback';
import { RouteSeoService } from './core/seo/route-seo.service';
import { SeoService } from './core/seo/seo.service';
import { CartAddToastComponent } from './shared/ui/cart-add-toast/cart-add-toast';
import { CookieConsentComponent } from './shared/ui/cookie-consent/cookie-consent';
import { RuntimeConfigService } from './core/config/runtime-config.service';
import { MaintenanceComponent } from './features/maintenance/maintenance';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Navbar,
    Footer,
    BackendFallbackComponent,
    CartAddToastComponent,
    CookieConsentComponent,
    MaintenanceComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly backendStatus = inject(BackendStatusService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly routeSeo = inject(RouteSeoService);
  private readonly seo = inject(SeoService);
  private readonly config = inject(RuntimeConfigService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.initialUrl()),
    ),
    { initialValue: this.initialUrl() },
  );

  protected readonly showBackendFallback = computed(() => this.backendStatus.unavailable());
  protected readonly showStandaloneComingSoon = computed(() =>
    this.isComingSoonUrl(this.currentUrl()),
  );
  protected readonly showMaintenance = computed(
    () => this.config.maintenanceMode && !this.isAdminUrl(this.currentUrl()),
  );

  constructor() {
    effect(() => {
      if (this.showMaintenance()) {
        this.seo.setPage({
          title: 'Radimo na poboljšanjima | Planeta',
          description: this.config.maintenanceMessage,
          path: this.currentUrl().split('?')[0] || '/',
          noindex: true,
        });
        this.seo.clearStructuredData();
        return;
      }

      if (this.showBackendFallback()) {
        this.seo.setPage({
          title: 'Privremeni prekid rada | Planeta',
          description:
            'Planeta webshop je privremeno nedostupan zbog tehničkih poteškoća. Uskoro ponovo nastavljamo sa radom.',
          path: this.router.url.split('?')[0] || '/',
          noindex: true,
        });
        this.seo.clearStructuredData();
        return;
      }

      this.routeSeo.refresh();
    });
  }

  retryBackend(): void {
    this.backendStatus.markAvailable();
    void this.router.navigateByUrl(this.router.url, { replaceUrl: true });
  }

  private isAdminUrl(url: string): boolean {
    const path = String(url ?? '').split('?')[0].split('#')[0];
    return /^\/admin(?:\/|$)/.test(path);
  }

  private isComingSoonUrl(url: string): boolean {
    const path = String(url ?? '')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/+$/, '');
    return path === '/test/comming-soon';
  }

  private initialUrl(): string {
    const location = this.document.location;
    if (!location) return this.router.url;
    return `${location.pathname}${location.search}${location.hash}`;
  }
}
