import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

type VerificationFailureReason =
  | 'expired-token'
  | 'invalid-token'
  | 'missing-token'
  | 'already-verified'
  | 'already-delivered'
  | 'rejected'
  | 'backend-error'
  | 'verification-failed'
  | 'unknown';

type VerificationFailureViewModel = {
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
  selector: 'app-order-verification-failed-page',
  standalone: true,
  imports: [CommonModule, StatusPageComponent],
  templateUrl: './order-verification-failed-page.html',
  styleUrl: './order-verification-failed-page.scss',
})
export class OrderVerificationFailedPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  readonly reason = computed<VerificationFailureReason>(() => this.resolveReason());

  readonly view = computed<VerificationFailureViewModel>(() => {
    switch (this.reason()) {
      case 'expired-token':
        return {
          tone: 'warning',
          icon: '!',
          title: 'Link za potvrdu izmjena je istekao',
          message:
            'Rok za potvrdu izmjena narudžbe je istekao. Kontaktirajte prodavca za dalje informacije.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Potvrda izmjena je istekla | Planeta',
          seoDescription: 'Rok za potvrdu izmjena narudžbe je istekao.',
        };

      case 'already-verified':
        return {
          tone: 'warning',
          icon: '!',
          title: 'Izmjene su već potvrđene',
          message: 'Ovaj link je već iskorišten. Izmjene narudžbe prethodno su potvrđene.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Izmjene su već potvrđene | Planeta',
          seoDescription: 'Izmjene narudžbe su već potvrđene i link više nije potrebno koristiti.',
        };

      case 'already-delivered':
        return {
          tone: 'warning',
          icon: '!',
          title: 'Narudžba je već kompletirana',
          message: 'Izmjene više nije moguće potvrditi jer je narudžba već kompletirana.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Narudžba je već kompletirana | Planeta',
          seoDescription: 'Potvrda izmjena nije dostupna za već kompletiranu narudžbu.',
        };

      case 'rejected':
        return {
          tone: 'error',
          icon: '!',
          title: 'Narudžba je otkazana',
          message: 'Predložene izmjene nisu prihvaćene, pa je narudžba otkazana.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Napravite novu narudžbu',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Narudžba je otkazana | Planeta',
          seoDescription: 'Izmjene otkazane narudžbe nije moguće potvrditi.',
        };

      case 'missing-token':
        return {
          tone: 'error',
          icon: '!',
          title: 'Nedostaje token za potvrdu izmjena',
          message:
            'Link koji ste otvorili nije kompletan. Otvorite najnoviju email poruku sa izmjenama narudžbe.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Potvrda nije uspjela | Planeta',
          seoDescription: 'Nedostaje token za potvrdu izmjena narudžbe.',
        };

      case 'invalid-token':
        return {
          tone: 'error',
          icon: '!',
          title: 'Link za potvrdu izmjena nije važeći',
          message:
            'Link koji ste otvorili nije važeći. Koristite najnoviju email poruku sa izmjenama narudžbe.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Potvrda nije uspjela | Planeta',
          seoDescription: 'Link za potvrdu izmjena narudžbe nije važeći.',
        };

      case 'backend-error':
      case 'verification-failed':
      case 'unknown':
      default:
        return {
          tone: 'error',
          icon: '!',
          title: 'Potvrda izmjena nije uspjela',
          message:
            'Trenutno ne možemo završiti potvrdu izmjena narudžbe. Pokušajte ponovo kasnije ili kontaktirajte podršku.',
          primaryText: 'Nazad na početnu',
          primaryLink: '/',
          secondaryText: 'Otvorite katalog',
          secondaryLink: '/catalog/muskarci/obuca',
          seoTitle: 'Potvrda nije uspjela | Planeta',
          seoDescription: 'Potvrda izmjena narudžbe trenutno nije dostupna.',
        };
    }
  });

  constructor() {
    effect(() => {
      const vm = this.view();
      this.seo.setPage({
        title: vm.seoTitle,
        description: vm.seoDescription,
        path: '/order/verification-failed',
        noindex: true,
      });
    });
  }

  private resolveReason(): VerificationFailureReason {
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

    if (combined.includes('expired') || combined.includes('istek') || combined.includes('timeout')) {
      return 'expired-token';
    }

    if (combined.includes('deliver') || combined.includes('isporuc')) {
      return 'already-delivered';
    }

    if (combined.includes('reject') || combined.includes('odbij') || combined.includes('otkaz')) {
      return 'rejected';
    }

    if (
      combined.includes('already verified') ||
      combined.includes('already confirmed') ||
      combined.includes('already-verified') ||
      combined.includes('already performed') ||
      combined.includes('already-processed') ||
      (combined.includes('vec') && combined.includes('potvrd')) ||
      (combined.includes('već') && combined.includes('potvrd'))
    ) {
      return 'already-verified';
    }

    if (
      combined.includes('missing token') ||
      combined.includes('missing-token') ||
      combined.includes('nedostaje token')
    ) {
      return 'missing-token';
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
      return 'verification-failed';
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
