import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

type NewsletterFailureReason =
  | 'invalid-token'
  | 'expired-token'
  | 'missing-token'
  | 'already-unsubscribed'
  | 'request-failed'
  | 'backend-error'
  | 'unknown';

type NewsletterFailureViewModel = {
  tone: StatusTone;
  icon: string;
  title: string;
  message: string;
  primaryText: string;
  primaryLink: string;
  secondaryText: string;
  secondaryLink: string;
  seoTitle: string;
  seoDescription: string;
};

@Component({
  selector: 'app-newsletter-unsubscribe-failed-page',
  standalone: true,
  imports: [CommonModule, StatusPageComponent],
  templateUrl: './newsletter-unsubscribe-failed-page.html',
  styleUrl: './newsletter-unsubscribe-failed-page.scss',
})
export class NewsletterUnsubscribeFailedPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  readonly reason = computed<NewsletterFailureReason>(() => this.resolveReason());

  readonly view = computed<NewsletterFailureViewModel>(() => {
    switch (this.reason()) {
      case 'already-unsubscribed':
        return {
          tone: 'warning',
          icon: '!',
          title: 'Adresa je već odjavljena',
          message: 'Ova email adresa je već uklonjena sa newsletter liste.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Newsletter odjava već izvršena | Planeta',
          seoDescription: 'Email adresa je već odjavljena sa newsletter liste.',
        };

      case 'expired-token':
        return {
          tone: 'warning',
          icon: '!',
          title: 'Link za odjavu je istekao',
          message:
            'Link koji ste otvorili više nije važeći. Otvorite najnoviju newsletter email poruku i pokušajte ponovo.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Link za odjavu je istekao | Planeta',
          seoDescription: 'Rok za newsletter odjavu je istekao.',
        };

      case 'missing-token':
        return {
          tone: 'error',
          icon: '!',
          title: 'Nedostaje link za odjavu',
          message:
            'Nismo uspjeli prepoznati zahtjev za odjavu. Koristite kompletan link iz newsletter poruke.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Odjava nije uspjela | Planeta',
          seoDescription: 'Nedostaje token za newsletter odjavu.',
        };

      case 'invalid-token':
        return {
          tone: 'error',
          icon: '!',
          title: 'Link za odjavu nije važeći',
          message:
            'Link koji ste otvorili nije važeći. Otvorite najnoviju newsletter email poruku i pokušajte ponovo.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Odjava nije uspjela | Planeta',
          seoDescription: 'Newsletter odjava nije mogla biti potvrđena.',
        };

      case 'backend-error':
      case 'request-failed':
      case 'unknown':
      default:
        return {
          tone: 'error',
          icon: '!',
          title: 'Odjava trenutno nije dostupna',
          message:
            'Trenutno nismo uspjeli završiti odjavu sa newsletter liste. Pokušajte ponovo malo kasnije.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Odjava nije uspjela | Planeta',
          seoDescription: 'Newsletter odjava trenutno nije dostupna.',
        };
    }
  });

  constructor() {
    effect(() => {
      const vm = this.view();
      this.seo.setPage({
        title: vm.seoTitle,
        description: vm.seoDescription,
        path: '/newsletter/unsubscribe-failed',
        noindex: true,
      });
    });
  }

  private resolveReason(): NewsletterFailureReason {
    const query = this.route.snapshot.queryParamMap;

    const tokenExpired = this.toBoolean(query.get('tokenExpired'));
    if (tokenExpired) return 'expired-token';

    const candidates = [
      query.get('reason'),
      query.get('status'),
      query.get('error'),
      query.get('errorCode'),
      query.get('code'),
      query.get('message'),
    ];

    const combined = this.normalizeText(candidates.filter(Boolean).join(' '));

    if (!combined) return 'unknown';

    if (
      combined.includes('already unsubscribed') ||
      (combined.includes('vec') && combined.includes('odjav')) ||
      (combined.includes('već') && combined.includes('odjav')) ||
      combined.includes('already-unsubscribed')
    ) {
      return 'already-unsubscribed';
    }

    if (
      combined.includes('missing token') ||
      combined.includes('missing-token') ||
      combined.includes('token missing') ||
      combined.includes('nedostaje token')
    ) {
      return 'missing-token';
    }

    if (combined.includes('expired') || combined.includes('istek') || combined.includes('istekao')) {
      return 'expired-token';
    }

    if (
      combined.includes('invalid') ||
      combined.includes('not valid') ||
      combined.includes('nevalid') ||
      combined.includes('bad token')
    ) {
      return 'invalid-token';
    }

    if (combined.includes('backend') || combined.includes('server') || combined.includes('500')) {
      return 'backend-error';
    }

    if (combined.includes('failed') || combined.includes('error') || combined.includes('gresk')) {
      return 'request-failed';
    }

    return 'unknown';
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .trim();
  }

  private toBoolean(value: string | null): boolean {
    const normalized = this.normalizeText(value);
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
}
