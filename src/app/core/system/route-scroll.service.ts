import { DOCUMENT, ViewportScroller, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RouteScrollService {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.router.events
      .pipe(filter((event): event is Scroll => event instanceof Scroll))
      .subscribe((event) => this.handleScrollEvent(event));
  }

  private handleScrollEvent(event: Scroll): void {
    if (event.anchor) {
      this.deferScroll(() => this.viewportScroller.scrollToAnchor(event.anchor!));
      return;
    }

    if (event.position) {
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
    });

    setTimeout(() => {
      work();
    }, 0);
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
