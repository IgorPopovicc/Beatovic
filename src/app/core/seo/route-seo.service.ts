import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';

type RouteSeoData = {
  title: string;
  description: string;
  noindex?: boolean;
  ogType?: 'website' | 'product' | 'article';
  image?: string | null;
};

@Injectable({ providedIn: 'root' })
export class RouteSeoService {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  private readonly defaultTitle = 'Planeta | Online Shop';
  private readonly defaultDescription =
    'Planeta webshop: patike, odjeća i oprema sa brzom isporukom i sigurnom kupovinom.';

  constructor() {
    this.refresh();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    this.applyFromRoute();
  }

  private applyFromRoute(): void {
    const leaf = this.deepest(this.router.routerState.snapshot.root);
    const seoData = leaf.data['seo'] as RouteSeoData | undefined;
    const path = this.router.url.split('?')[0] || '/';

    if (!seoData) {
      this.seo.setPage({
        title: this.defaultTitle,
        description: this.defaultDescription,
        path,
        ogType: 'website',
      });
      this.seo.clearStructuredData();
      return;
    }

    this.seo.setPage({
      title: seoData.title,
      description: seoData.description,
      noindex: seoData.noindex,
      ogType: seoData.ogType ?? 'website',
      image: seoData.image ?? null,
      path,
    });
    this.seo.clearStructuredData();
  }

  private deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
}
