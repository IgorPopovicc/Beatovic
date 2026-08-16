import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CustomerEmailActionsApiService } from '../../core/api/customer-email-actions-api.service';
import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

type NewsletterState = 'loading' | 'success' | 'invalid';

type NewsletterViewModel = {
  tone: StatusTone;
  icon: string;
  title: string;
  message: string;
  details: string | null;
  primaryText: string;
  primaryLink: string;
  secondaryText: string;
  secondaryLink: string;
  seoTitle: string;
  seoDescription: string;
};

@Component({
  selector: 'app-newsletter-unsubscribe-page',
  standalone: true,
  imports: [CommonModule, StatusPageComponent],
  templateUrl: './newsletter-unsubscribe-page.html',
  styleUrl: './newsletter-unsubscribe-page.scss',
})
export class NewsletterUnsubscribePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly emailActionsApi = inject(CustomerEmailActionsApiService);
  private readonly seo = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly state = signal<NewsletterState>('loading');
  readonly details = signal<string | null>(null);

  readonly view = computed<NewsletterViewModel>(() => {
    const details = this.details();

    if (this.state() === 'loading') {
      return {
        tone: 'info',
        icon: 'i',
        title: 'Provjeravamo odjavu',
        message: 'Sačekajte trenutak dok završimo odjavu sa newsletter liste.',
        details: null,
        primaryText: 'Početna',
        primaryLink: '/',
        secondaryText: 'Katalog',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Odjava sa newsletter liste | Planeta',
        seoDescription: 'Obrada zahtjeva za odjavu sa newsletter liste.',
      };
    }

    if (this.state() === 'success') {
      return {
        tone: 'success',
        icon: '✓',
        title: 'Uspješno ste odjavljeni',
        message:
          'Vaša email adresa je uklonjena sa newsletter liste i više nećete primati promotivne poruke.',
        details,
        primaryText: 'Nazad na početnu',
        primaryLink: '/',
        secondaryText: 'Nastavite kupovinu',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Odjava uspješna | Planeta',
        seoDescription: 'Uspješno ste odjavljeni sa newsletter liste.',
      };
    }

    return {
      tone: 'error',
      icon: '!',
      title: 'Odjava trenutno nije dostupna',
      message:
        'Link za odjavu nije važeći ili je istekao. Ako želite, pokušajte ponovo iz najnovije email poruke.',
      details,
      primaryText: 'Nazad na početnu',
      primaryLink: '/',
      secondaryText: 'Otvorite katalog',
      secondaryLink: '/catalog/muskarci/obuca',
      seoTitle: 'Odjava nije uspjela | Planeta',
      seoDescription: 'Link za odjavu sa newsletter liste nije važeći ili je istekao.',
    };
  });

  constructor() {
    effect(() => {
      const vm = this.view();
      this.seo.setPage({
        title: vm.seoTitle,
        description: vm.seoDescription,
        path: '/newsletter/unsubscribe',
        noindex: true,
      });
    });
  }

  ngOnInit(): void {
    this.startFlow();
  }

  private startFlow(): void {
    const explicitStatus = this.normalizeStatusParam(this.route.snapshot.queryParamMap.get('status'));
    const queryReason = this.failureReasonFromQuery();
    const token = this.readToken();

    if (!token) {
      if (explicitStatus === 'success') {
        this.state.set('success');
        this.details.set(null);
        return;
      }

      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(queryReason ?? 'missing-token');
        return;
      }

      this.state.set('invalid');
      this.details.set('Nedostaje token za odjavu.');
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.state.set('loading');
    this.details.set(null);

    this.emailActionsApi.unsubscribeNewsletter(token).subscribe({
      next: (message) => {
        this.state.set('success');
        const clean = this.normalizeMessage(message);
        this.details.set(clean || null);
      },
      error: (err: unknown) => {
        this.handleUnsubscribeError(err);
      },
    });
  }

  private handleUnsubscribeError(err: unknown): void {
    const httpError = err instanceof HttpErrorResponse ? err : null;
    const message = this.extractErrorMessage(err);
    const normalized = this.normalizeText(message);

    if (
      normalized.includes('already unsubscribed') ||
      (normalized.includes('vec') && normalized.includes('odjav')) ||
      (normalized.includes('već') && normalized.includes('odjav'))
    ) {
      this.redirectToFailure('already-unsubscribed');
      return;
    }

    if (
      normalized.includes('expired') ||
      normalized.includes('istek') ||
      normalized.includes('istekao')
    ) {
      this.redirectToFailure('expired-token');
      return;
    }

    if (
      normalized.includes('invalid') ||
      normalized.includes('not valid') ||
      normalized.includes('nevalid') ||
      normalized.includes('bad token')
    ) {
      this.redirectToFailure('invalid-token');
      return;
    }

    if (httpError?.status && httpError.status >= 500) {
      this.redirectToFailure('backend-error');
      return;
    }

    this.redirectToFailure('request-failed');
  }

  private readToken(): string {
    const pathToken = this.route.snapshot.paramMap.get('token');
    const queryToken =
      this.route.snapshot.queryParamMap.get('token') ?? this.route.snapshot.queryParamMap.get('t');

    return String(pathToken ?? queryToken ?? '').trim();
  }

  private normalizeStatusParam(value: string | null): 'success' | null {
    const status = this.normalizeText(value);
    if (status === 'success' || status === 'ok') return 'success';
    return null;
  }

  private failureReasonFromQuery():
    | 'invalid-token'
    | 'expired-token'
    | 'already-unsubscribed'
    | 'backend-error'
    | 'request-failed'
    | null {
    const query = this.route.snapshot.queryParamMap;
    const tokenExpired = this.normalizeText(query.get('tokenExpired'));
    if (tokenExpired === '1' || tokenExpired === 'true' || tokenExpired === 'yes') {
      return 'expired-token';
    }

    const combined = this.normalizeText(
      [
        query.get('reason'),
        query.get('status'),
        query.get('error'),
        query.get('errorCode'),
        query.get('code'),
        query.get('message'),
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (!combined) return null;

    if (
      combined.includes('already unsubscribed') ||
      combined.includes('already-unsubscribed') ||
      (combined.includes('vec') && combined.includes('odjav')) ||
      (combined.includes('već') && combined.includes('odjav'))
    ) {
      return 'already-unsubscribed';
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

    return null;
  }

  private extractErrorMessage(err: unknown): string | null {
    if (err instanceof HttpErrorResponse) {
      const nestedError = this.stringFromUnknown(err.error);
      if (nestedError) return nestedError;
      const nestedMessage = this.messageFromObject(err.error);
      if (nestedMessage) return nestedMessage;
      return this.normalizeMessage(err.message);
    }

    return this.stringFromUnknown(err);
  }

  private messageFromObject(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;

    const message = (value as Record<string, unknown>)['message'];
    return this.stringFromUnknown(message);
  }

  private stringFromUnknown(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return this.normalizeMessage(value);
  }

  private normalizeMessage(value: string | null | undefined): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return raw.replace(/\s+/g, ' ');
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .trim();
  }

  private redirectToFailure(
    reason:
      | 'invalid-token'
      | 'expired-token'
      | 'missing-token'
      | 'already-unsubscribed'
      | 'backend-error'
      | 'request-failed',
  ): void {
    const queryParams: Record<string, string | boolean> = { reason };
    if (reason === 'expired-token') {
      queryParams['tokenExpired'] = true;
    }

    void this.router
      .navigate(['/newsletter/unsubscribe-failed'], {
        queryParams,
        replaceUrl: true,
      })
      .catch(() => {
        this.state.set('invalid');
        this.details.set('Odjava trenutno nije dostupna. Pokušajte ponovo kasnije.');
      });
  }
}
