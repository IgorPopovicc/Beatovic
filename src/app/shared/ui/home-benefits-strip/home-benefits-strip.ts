import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type HomeBenefit = {
  icon: string;
  title: string;
  description: string;
  link?: string[];
  queryParams?: Record<string, string | number>;
};

@Component({
  selector: 'app-home-benefits-strip',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-benefits-strip.html',
  styleUrl: './home-benefits-strip.scss',
})
export class HomeBenefitsStrip {
  readonly benefits: HomeBenefit[] = [
    {
      icon: 'local_shipping',
      title: 'Brza isporuka',
      description: 'Slanje porudžbina širom BiH u kratkom roku.',
    },
    {
      icon: 'sync_alt',
      title: 'Jednostavan povrat',
      description: 'Brza zamjena veličine i transparentan proces povrata.',
      link: ['/catalog', 'muskarci', 'obuca'],
      queryParams: { sale: 1 },
    },
    {
      icon: 'verified_user',
      title: 'Sigurna kupovina',
      description: 'Zaštićeno plaćanje i sigurna obrada podataka o porudžbini.',
    },
    {
      icon: 'support_agent',
      title: 'Podrška kupcima',
      description: 'Tim podrške je dostupan za pomoć oko izbora i narudžbine.',
      link: ['/brands'],
    },
  ];
}
