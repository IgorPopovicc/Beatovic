import { Component, inject, OnInit } from '@angular/core';
import { HeroSlider } from '../../../shared/ui/hero-slider/hero-slider';
import { BrandsSlider } from '../../../shared/ui/brands-slider/brands-slider';
import { NewCollection } from '../../../shared/ui/new-collection/new-collection';
import { DiscountSlider } from '../../../shared/ui/discount-slider/discount-slider';
import { ColmarSpotlight } from '../../../shared/ui/colmar-spotlight/colmar-spotlight';
import { HomeBenefitsStrip } from '../../../shared/ui/home-benefits-strip/home-benefits-strip';
import { HomeNewsletter } from '../../../shared/ui/home-newsletter/home-newsletter';
import { SeoService } from '../../../core/seo/seo.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [
    HeroSlider,
    BrandsSlider,
    NewCollection,
    DiscountSlider,
    ColmarSpotlight,
    HomeBenefitsStrip,
    HomeNewsletter,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const newsletterStatus = String(this.route.snapshot.queryParamMap.get('newsletter') ?? '')
      .trim()
      .toLowerCase();
    const newsletterRoutes: Record<string, string> = {
      confirmed: '/newsletter/confirmed',
      invalid: '/newsletter/invalid',
      unsubscribed: '/newsletter/unsubscribed',
      'unsubscribe-failed': '/newsletter/unsubscribe-failed',
    };
    if (newsletterRoutes[newsletterStatus]) {
      void this.router.navigateByUrl(newsletterRoutes[newsletterStatus], { replaceUrl: true });
      return;
    }

    const homeUrl = this.seo.absoluteUrl('/');
    const brandLogo = this.seo.absoluteUrl('/assets/images/logo/planets_main_logo.png');
    const shareImage = this.seo.absoluteUrl('/planeta-share.png');

    this.seo.setPage({
      title: 'Planeta webshop | Patike, odjeća i oprema online',
      description:
        'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.',
      path: '/',
      ogType: 'website',
      image: shareImage,
      imageAlt: 'Planeta webshop logo',
    });

    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'Planeta',
          url: homeUrl,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${this.seo.absoluteUrl('/products')}?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'WebPage',
          name: 'Planeta webshop',
          url: homeUrl,
          description:
            'Patike, odjeća i sportska oprema za muškarce i žene sa redovno osvježenim kolekcijama.',
          primaryImageOfPage: shareImage,
        },
        {
          '@type': 'Organization',
          name: 'Planeta',
          url: homeUrl,
          logo: brandLogo,
        },
      ],
    });
  }
}
