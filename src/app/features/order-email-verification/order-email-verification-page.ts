import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CustomerEmailActionsApiService } from '../../core/api/customer-email-actions-api.service';
import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

type OrderVerifyState = 'loading' | 'success' | 'expired' | 'invalid';

type OrderVerifyViewModel = {
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
  selector: 'app-order-email-verification-page',
  standalone: true,
  imports: [CommonModule, StatusPageComponent],
  templateUrl: './order-email-verification-page.html',
  styleUrl: './order-email-verification-page.scss',
})
export class OrderEmailVerificationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly emailActionsApi = inject(CustomerEmailActionsApiService);
  private readonly seo = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly state = signal<OrderVerifyState>('loading');
  readonly details = signal<string | null>(null);

  readonly view = computed<OrderVerifyViewModel>(() => {
    const details = this.details();

    if (this.state() === 'loading') {
      return {
        tone: 'info',
        icon: 'i',
        title: 'Provjeravamo potvrdu narudžbe',
        message: 'Sačekajte trenutak dok obradimo vašu potvrdu iz email poruke.',
        details: null,
        primaryText: 'Početna',
        primaryLink: '/',
        secondaryText: 'Katalog',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Potvrda narudžbe | Planeta',
        seoDescription: 'Provjera email potvrde narudžbe.',
      };
    }

    if (this.state() === 'success') {
      return {
        tone: 'success',
        icon: '✓',
        title: 'Narudžba je uspješno potvrđena',
        message:
          'Hvala vam. Vaša narudžba je potvrđena i prelazi u dalju obradu. O narednim koracima ćemo vas obavijestiti email porukom.',
        details,
        primaryText: 'Nazad na početnu',
        primaryLink: '/',
        secondaryText: 'Nastavi kupovinu',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Narudžba potvrđena | Planeta',
        seoDescription: 'Email potvrda narudžbe je uspješno završena.',
      };
    }

    if (this.state() === 'expired') {
      return {
        tone: 'warning',
        icon: '!',
        title: 'Rok za potvrdu je istekao',
        message:
          'Ovu narudžbu više nije moguće potvrditi jer je istekao vremenski rok za potvrdu putem email-a.',
        details:
          details ??
          'Ako i dalje želite iste proizvode, potrebno je napraviti novu narudžbu kroz webshop.',
        primaryText: 'Napravi novu narudžbu',
        primaryLink: '/catalog/muskarci/obuca',
        secondaryText: 'Nazad na početnu',
        secondaryLink: '/',
        seoTitle: 'Potvrda narudžbe je istekla | Planeta',
        seoDescription: 'Rok za potvrdu narudžbe putem email-a je istekao.',
      };
    }

    return {
      tone: 'error',
      icon: '!',
      title: 'Link za potvrdu nije važeći',
      message:
        'Link koji ste otvorili nije validan ili je već iskorišten. Otvorite najnoviji email za narudžbu i pokušajte ponovo.',
      details,
      primaryText: 'Nazad na početnu',
      primaryLink: '/',
      secondaryText: 'Otvori katalog',
      secondaryLink: '/catalog/muskarci/obuca',
      seoTitle: 'Potvrda narudžbe nije uspjela | Planeta',
      seoDescription: 'Link za potvrdu narudžbe nije važeći.',
    };
  });

  constructor() {
    effect(() => {
      const vm = this.view();
      this.seo.setPage({
        title: vm.seoTitle,
        description: vm.seoDescription,
        path: '/order/verify',
        noindex: true,
      });
    });
  }

  ngOnInit(): void {
    this.startFlow();
  }

  private startFlow(): void {
    const explicitState = this.stateFromStatusParam(this.route.snapshot.queryParamMap.get('status'));
    const explicitMessage = this.normalizeMessage(this.route.snapshot.queryParamMap.get('message'));
    const token = this.readToken();

    if (!token) {
      if (explicitState && explicitState !== 'loading') {
        this.state.set(explicitState);
        this.details.set(explicitMessage);
        return;
      }

      this.state.set('invalid');
      this.details.set('Nedostaje token za potvrdu narudžbe.');
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.state.set('loading');
    this.details.set(null);

    this.emailActionsApi.verifyOrderEmail(token).subscribe({
      next: (response) => this.handleVerifySuccess(response),
      error: (err: unknown) => this.handleVerifyError(err),
    });
  }

  private handleVerifySuccess(response: HttpResponse<string>): void {
    const stateFromUrl = this.stateFromResponseUrl(response.url);
    if (stateFromUrl && stateFromUrl !== 'loading') {
      this.state.set(stateFromUrl);
      this.details.set(this.normalizeMessage(response.body));
      return;
    }

    const body = this.normalizeText(response.body);
    const detail = this.normalizeMessage(response.body);

    if (this.looksExpired(body)) {
      this.state.set('expired');
      this.details.set(detail);
      return;
    }

    if (this.looksInvalid(body)) {
      this.state.set('invalid');
      this.details.set(detail);
      return;
    }

    if (this.looksAlreadyConfirmed(body)) {
      this.state.set('success');
      this.details.set(detail ?? 'Narudžba je već potvrđena.');
      return;
    }

    this.state.set('success');
    this.details.set(detail);
  }

  private handleVerifyError(err: unknown): void {
    const httpError = err instanceof HttpErrorResponse ? err : null;
    const message = this.extractErrorMessage(err);
    const normalized = this.normalizeText(message);

    const stateFromUrl = this.stateFromResponseUrl(httpError?.url ?? null);
    if (stateFromUrl && stateFromUrl !== 'loading') {
      this.state.set(stateFromUrl);
      this.details.set(message);
      return;
    }

    if (httpError?.status === 409 && this.looksAlreadyConfirmed(normalized)) {
      this.state.set('success');
      this.details.set(message ?? 'Narudžba je već potvrđena.');
      return;
    }

    if (httpError?.status === 410 || (httpError?.status === 400 && this.looksExpired(normalized))) {
      this.state.set('expired');
      this.details.set(message);
      return;
    }

    this.state.set('invalid');
    this.details.set(message ?? 'Potvrda narudžbe trenutno nije moguća. Pokušajte ponovo kasnije.');
  }

  private readToken(): string {
    const pathToken = this.route.snapshot.paramMap.get('token');
    const queryToken =
      this.route.snapshot.queryParamMap.get('token') ?? this.route.snapshot.queryParamMap.get('t');

    return String(pathToken ?? queryToken ?? '').trim();
  }

  private stateFromStatusParam(value: string | null): OrderVerifyState | null {
    const status = this.normalizeText(value);

    if (!status) return null;
    if (status === 'success' || status === 'confirmed' || status === 'email_verified') {
      return 'success';
    }
    if (status === 'expired' || status === 'timeout') {
      return 'expired';
    }
    if (status === 'invalid' || status === 'error' || status === 'failed') {
      return 'invalid';
    }

    return null;
  }

  private stateFromResponseUrl(url: string | null): OrderVerifyState | null {
    if (!url) return null;

    try {
      const parsed = new URL(url, 'https://planeta.local');
      const statusFromQuery = this.stateFromStatusParam(parsed.searchParams.get('status'));
      if (statusFromQuery) return statusFromQuery;

      const combined = this.normalizeText(`${parsed.pathname} ${parsed.search}`);
      if (this.looksExpired(combined)) return 'expired';
      if (this.looksInvalid(combined)) return 'invalid';
      if (combined.includes('success') || combined.includes('confirmed') || combined.includes('potvrd')) {
        return 'success';
      }
    } catch {
      return null;
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

  private normalizeMessage(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (/<[a-z][\s\S]*>/i.test(raw)) return null;
    if (raw.length > 280) return null;
    return raw.replace(/\s+/g, ' ');
  }

  private looksExpired(value: string): boolean {
    return (
      value.includes('expired') ||
      value.includes('istek') ||
      value.includes('isteka') ||
      value.includes('time window')
    );
  }

  private looksAlreadyConfirmed(value: string): boolean {
    return (
      value.includes('already') && (value.includes('confirm') || value.includes('verif')) ||
      (value.includes('vec') && value.includes('potvrd')) ||
      (value.includes('već') && value.includes('potvrd'))
    );
  }

  private looksInvalid(value: string): boolean {
    return (
      value.includes('invalid') ||
      value.includes('not valid') ||
      value.includes('nevalid') ||
      value.includes('gresk') ||
      value.includes('grešk') ||
      value.includes('not found')
    );
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .trim();
  }
}
