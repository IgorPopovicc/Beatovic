import { DOCUMENT, ViewportScroller, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, Scroll } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RouteScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private lastNavigationTrigger: NavigationStart['navigationTrigger'] = 'imperative';
  private lastNavigationHadAnchor = false;
  private handledScrollForCurrentNavigation = false;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => this.handleNavigationStart(event));

    this.router.events
      .pipe(filter((event): event is Scroll => event instanceof Scroll))
      .subscribe((event) => this.handleScrollEvent(event));

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.handleNavigationEndFallback());
  }

  private handleNavigationStart(event: NavigationStart): void {
    this.lastNavigationTrigger = event.navigationTrigger;
    this.lastNavigationHadAnchor = event.url.includes('#');
    this.handledScrollForCurrentNavigation = false;
  }

  private handleNavigationEndFallback(): void {
    if (this.handledScrollForCurrentNavigation) return;
    if (this.lastNavigationHadAnchor) return;
    if (this.lastNavigationTrigger === 'popstate') return;

    this.deferScroll(() => this.scrollToTop());
  }

  private handleScrollEvent(event: Scroll): void {
    this.handledScrollForCurrentNavigation = true;

    if (event.anchor) {
      this.deferScroll(() => this.viewportScroller.scrollToAnchor(event.anchor!));
      return;
    }

    if (event.position && this.lastNavigationTrigger === 'popstate') {
      // Back/forward navigation: preserve expected browser history position.
      this.deferScroll(() => this.viewportScroller.scrollToPosition(event.position!));
      return;
    }

    // New route navigation: always start at top.
    this.deferScroll(() => this.scrollToTop());
  }

  private deferScroll(work: () => void): void {
    work();

    requestAnimationFrame(() => {
      work();
      requestAnimationFrame(() => work());
    });

    setTimeout(() => {
      work();
    }, 80);
  }

  private scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });

    const scrollingElement = this.document.scrollingElement as HTMLElement | null;
    if (scrollingElement) {
      scrollingElement.scrollTop = 0;
      scrollingElement.scrollLeft = 0;
    }

    const appPage = this.document.querySelector<HTMLElement>('.page');
    if (appPage && appPage.scrollHeight > appPage.clientHeight) {
      appPage.scrollTop = 0;
      appPage.scrollLeft = 0;
    }
  }
}
