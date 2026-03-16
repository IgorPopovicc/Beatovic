import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Navbar } from './shared/ui/navbar/navbar';
import { Footer } from './shared/ui/footer/footer';
import { BackendStatusService } from './core/system/backend-status.service';
import { BackendFallbackComponent } from './features/backend-fallback/backend-fallback';
import { RouteSeoService } from './core/seo/route-seo.service';
import { SeoService } from './core/seo/seo.service';
import { CartAddToastComponent } from './shared/ui/cart-add-toast/cart-add-toast';
import { RouteScrollService } from './core/system/route-scroll.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, BackendFallbackComponent, CartAddToastComponent],
  templateUrl: './app.html',
})
export class App {
  private readonly backendStatus = inject(BackendStatusService);
  private readonly router = inject(Router);
  private readonly routeSeo = inject(RouteSeoService);
  private readonly seo = inject(SeoService);
  private readonly routeScroll = inject(RouteScrollService);

  protected readonly showBackendFallback = computed(() => this.backendStatus.unavailable());

  constructor() {
    effect(() => {
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
}
