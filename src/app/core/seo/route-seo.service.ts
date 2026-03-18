import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';
import { ProductDetailsResolved } from '../../features/product-details/product-details.resolver';

type RouteSeoData = {
  title: string;
  description: string;
  noindex?: boolean;
  ogType?: 'website' | 'product' | 'article';
  image?: string | null;
  imageAlt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class RouteSeoService {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  private readonly defaultTitle = 'Planeta webshop | Patike, odjeća i oprema online';
  private readonly defaultDescription =
    'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.';

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
    const path = this.router.url.split('?')[0] || '/';
    const resolvedProduct = leaf.data['product'] as ProductDetailsResolved | null | undefined;

    if (resolvedProduct !== undefined) {
      this.applyProductSeo(path, resolvedProduct);
      return;
    }

    const seoData = leaf.data['seo'] as RouteSeoData | undefined;

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
      imageAlt: seoData.imageAlt ?? null,
      path,
    });

    const managedByComponent = leaf.data['structuredDataManaged'] === true;
    if (!managedByComponent) {
      this.seo.clearStructuredData();
    }
  }

  private applyProductSeo(path: string, product: ProductDetailsResolved | null): void {
    if (!product) {
      this.seo.setPage({
        title: 'Proizvod nije dostupan | Planeta',
        description: 'Traženi proizvod nije dostupan ili ne postoji.',
        path,
        ogType: 'website',
        noindex: true,
      });
      this.seo.clearStructuredData();
      return;
    }

    const description = product.seoDescription;
    const image = product.seoImage?.url ?? null;
    const imageAlt = product.seoImage?.alt ?? product.name;

    this.seo.setPage({
      title: `${product.name} | Planeta`,
      description,
      path,
      ogType: 'product',
      image,
      imageAlt,
    });

    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      image: image ? [image] : [this.seo.absoluteUrl('/assets/images/logo/planets_main_logo.png')],
      sku: product.sku ?? product.id,
      brand: {
        '@type': 'Brand',
        name: product.brand || 'Planeta',
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: product.currency || 'RSD',
        price: Number(product.price || 0).toFixed(2),
        availability: product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: this.seo.absoluteUrl(path),
      },
    });
  }

  private deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
}
