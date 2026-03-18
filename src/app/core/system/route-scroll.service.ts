import { DOCUMENT, ViewportScroller, isPlatformBrowser } from '@angular/common';
import { Injector, afterNextRender, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RouteScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.handleNavigationEnd(event));
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const fragment = this.router.parseUrl(event.urlAfterRedirects).fragment;

    afterNextRender(
      () => {
        if (fragment) {
          this.deferScroll(() => this.viewportScroller.scrollToAnchor(fragment));
          return;
        }

        this.deferScroll(() => this.scrollToTop());
      },
      { injector: this.injector },
    );
  }

  private deferScroll(work: () => void): void {
    work();

    Promise.resolve().then(() => work());

    requestAnimationFrame(() => {
      work();
      setTimeout(work, 0);
    });

    setTimeout(() => {
      work();
    }, 120);

    // SSR hydration + async content can still shift scroll after first paint.
    setTimeout(() => {
      work();
    }, 280);
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

    for (const container of this.customScrollContainers()) {
      container.scrollTop = 0;
      container.scrollLeft = 0;
    }
  }

  private customScrollContainers(): HTMLElement[] {
    const unique = new Set<HTMLElement>();
    const candidates = this.document.querySelectorAll<HTMLElement>('.page, main, [data-scroll-container]');

    for (const el of candidates) {
      if (unique.has(el)) continue;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
      if (!scrollable) continue;
      if (el.scrollHeight <= el.clientHeight) continue;
      unique.add(el);
    }

    return Array.from(unique);
  }
}
