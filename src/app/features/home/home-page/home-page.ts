import { Component, inject, OnInit } from '@angular/core';
import { HeroSlider } from '../../../shared/ui/hero-slider/hero-slider';
import { BrandsSlider } from '../../../shared/ui/brands-slider/brands-slider';
import { NewCollection } from '../../../shared/ui/new-collection/new-collection';
import { DiscountSlider } from '../../../shared/ui/discount-slider/discount-slider';
import { ColmarSpotlight } from '../../../shared/ui/colmar-spotlight/colmar-spotlight';
import { HomeBenefitsStrip } from '../../../shared/ui/home-benefits-strip/home-benefits-strip';
import { SeoService } from '../../../core/seo/seo.service';

@Component({
  selector: 'app-home-page',
  imports: [
    HeroSlider,
    BrandsSlider,
    NewCollection,
    DiscountSlider,
    ColmarSpotlight,
    HomeBenefitsStrip,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    const homeUrl = this.seo.absoluteUrl('/');
    const brandImage = this.seo.absoluteUrl('/assets/images/logo/planets_main_logo.png');

    this.seo.setPage({
      title: 'Planeta webshop | Patike, odjeća i oprema online',
      description:
        'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.',
      path: '/',
      ogType: 'website',
      image: brandImage,
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
            target: `${this.seo.absoluteUrl('/catalog/muskarci/obuca')}?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'WebPage',
          name: 'Planeta webshop',
          url: homeUrl,
          description:
            'Patike, odjeća i sportska oprema za muškarce i žene sa redovno osvježenim kolekcijama.',
          primaryImageOfPage: brandImage,
        },
        {
          '@type': 'Organization',
          name: 'Planeta',
          url: homeUrl,
          logo: brandImage,
        },
      ],
    });
  }
}
