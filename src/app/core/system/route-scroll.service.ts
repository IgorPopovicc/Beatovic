import { DOCUMENT, ViewportScroller, isPlatformBrowser } from '@angular/common';
import { ApplicationRef, Injector, afterNextRender, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RouteScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private readonly pendingTimers = new Set<number>();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => {
        this.clearPendingTimers();
        this.forceWindowTop();
      });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.handleNavigationEnd(event));
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const fragment = this.router.parseUrl(event.urlAfterRedirects).fragment;

    afterNextRender(
      () => {
        const work = fragment
          ? () => this.viewportScroller.scrollToAnchor(fragment)
          : () => this.scrollToTop();
        this.deferScroll(work);
      },
      { injector: this.injector },
    );
  }

  private deferScroll(work: () => void): void {
    this.clearPendingTimers();

    work();
    Promise.resolve().then(() => work());

    const passes = [0, 40, 120, 240, 420];
    for (const delay of passes) {
      if (delay === 0) {
        requestAnimationFrame(() => work());
        continue;
      }

      const id = window.setTimeout(() => {
        requestAnimationFrame(() => work());
        this.pendingTimers.delete(id);
      }, delay);
      this.pendingTimers.add(id);
    }

    this.appRef.isStable
      .pipe(
        filter(Boolean),
        take(1),
      )
      .subscribe(() => {
        work();
        requestAnimationFrame(() => work());
      });
  }

  private scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);
    this.forceWindowTop();

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

  private forceWindowTop(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    this.document.documentElement.scrollTop = 0;
    this.document.body.scrollTop = 0;
  }

  private clearPendingTimers(): void {
    for (const id of this.pendingTimers) {
      clearTimeout(id);
    }
    this.pendingTimers.clear();
  }
}
