import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CustomerEmailActionsApiService } from '../../core/api/customer-email-actions-api.service';
import { SeoService } from '../../core/seo/seo.service';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

type OrderVerifyState = 'loading' | 'success' | 'expired' | 'invalid';
type VerificationFailedReason =
  | 'expired-token'
  | 'invalid-token'
  | 'missing-token'
  | 'already-verified'
  | 'already-delivered'
  | 'rejected'
  | 'backend-error'
  | 'verification-failed';

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
  private readonly router = inject(Router);
  private readonly emailActionsApi = inject(CustomerEmailActionsApiService);
  private readonly seo = inject(SeoService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = inject(RuntimeConfigService);

  readonly state = signal<OrderVerifyState>('loading');
  readonly details = signal<string | null>(null);

  readonly view = computed<OrderVerifyViewModel>(() => {
    const details = this.details();

    if (this.state() === 'loading') {
      return {
        tone: 'info',
        icon: 'i',
        title: 'Provjeravamo potvrdu izmjena narudžbe',
        message: 'Sačekajte trenutak dok obradimo potvrdu izmjena iz vaše email poruke.',
        details: null,
        primaryText: 'Početna',
        primaryLink: '/',
        secondaryText: 'Katalog',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Potvrda izmjena narudžbe | Planeta',
        seoDescription: 'Provjera potvrde izmjena narudžbe.',
      };
    }

    if (this.state() === 'success') {
      return {
        tone: 'success',
        icon: '✓',
        title: 'Izmjene narudžbe su uspješno potvrđene',
        message:
          'Hvala vam. Potvrdili ste izmjene narudžbe i ona prelazi u dalju obradu. O narednim koracima obavijestićemo vas email porukom.',
        details,
        primaryText: 'Nazad na početnu',
        primaryLink: '/',
        secondaryText: 'Nastavite kupovinu',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Izmjene narudžbe potvrđene | Planeta',
        seoDescription: 'Potvrda izmjena narudžbe je uspješno završena.',
      };
    }

    if (this.state() === 'expired') {
      return {
        tone: 'warning',
        icon: '!',
        title: 'Rok za potvrdu izmjena je istekao',
        message:
          'Izmjene narudžbe više nije moguće potvrditi ovim linkom jer je rok istekao.',
        details:
          details ??
          'Kontaktirajte prodavca ako su vam potrebne dodatne informacije o narudžbi.',
        primaryText: 'Nazad na početnu',
        primaryLink: '/',
        secondaryText: 'Otvorite katalog',
        secondaryLink: '/catalog/muskarci/obuca',
        seoTitle: 'Potvrda izmjena je istekla | Planeta',
        seoDescription: 'Rok za potvrdu izmjena narudžbe je istekao.',
      };
    }

    return {
      tone: 'error',
      icon: '!',
      title: 'Link za potvrdu izmjena nije važeći',
      message:
        'Link koji ste otvorili nije važeći ili je već iskorišten. Otvorite najnoviju email poruku sa izmjenama narudžbe i pokušajte ponovo.',
      details,
      primaryText: 'Nazad na početnu',
      primaryLink: '/',
      secondaryText: 'Otvorite katalog',
      secondaryLink: '/catalog/muskarci/obuca',
      seoTitle: 'Potvrda izmjena nije uspjela | Planeta',
      seoDescription: 'Link za potvrdu izmjena narudžbe nije važeći.',
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
    const queryReason = this.failureReasonFromQuery();
    const token = this.readToken();

    if (!token) {
      if (explicitState === 'success') {
        this.state.set('success');
        this.details.set(explicitMessage);
        return;
      }

      const explicitFailure = this.reasonFromState(explicitState);
      const reason = queryReason ?? explicitFailure ?? 'missing-token';

      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(reason);
        return;
      }

      this.applyLocalFailureState(reason);
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
    const reasonFromUrl = this.failureReasonFromUrl(response.url);
    if (reasonFromUrl) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(reasonFromUrl);
      } else {
        this.applyLocalFailureState(reasonFromUrl);
      }
      return;
    }

    const stateFromUrl = this.stateFromResponseUrl(response.url);
    const detail = this.normalizeMessage(response.body);

    if (stateFromUrl && stateFromUrl !== 'loading') {
      if (stateFromUrl === 'success') {
        this.state.set('success');
        this.details.set(detail);
        return;
      }

      const reason = this.reasonFromState(stateFromUrl) ?? 'verification-failed';
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(reason);
      } else {
        this.applyLocalFailureState(reason);
      }
      return;
    }

    const body = this.normalizeText(response.body);

    if (this.looksExpired(body)) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('expired-token');
      } else {
        this.applyLocalFailureState('expired-token');
      }
      return;
    }

    if (this.looksInvalid(body)) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('invalid-token');
      } else {
        this.applyLocalFailureState('invalid-token');
      }
      return;
    }

    if (this.looksAlreadyConfirmed(body)) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('already-verified');
      } else {
        this.applyLocalFailureState('already-verified');
      }
      return;
    }

    this.state.set('success');
    this.details.set(detail);
  }

  private handleVerifyError(err: unknown): void {
    const httpError = err instanceof HttpErrorResponse ? err : null;
    const message = this.extractErrorMessage(err);
    const normalized = this.normalizeText(message);

    const reasonFromUrl = this.failureReasonFromUrl(httpError?.url ?? null);
    if (reasonFromUrl) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(reasonFromUrl);
      } else {
        this.applyLocalFailureState(reasonFromUrl);
      }
      return;
    }

    const stateFromUrl = this.stateFromResponseUrl(httpError?.url ?? null);
    if (stateFromUrl && stateFromUrl !== 'loading') {
      const reason = this.reasonFromState(stateFromUrl);
      if (stateFromUrl === 'success') {
        this.state.set('success');
        this.details.set(message);
        return;
      }

      if (reason && isPlatformBrowser(this.platformId)) {
        this.redirectToFailure(reason);
        return;
      }

      if (reason) {
        this.applyLocalFailureState(reason);
        return;
      }
    }

    if (httpError?.status === 409 && this.looksAlreadyConfirmed(normalized)) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('already-verified');
      } else {
        this.applyLocalFailureState('already-verified');
      }
      return;
    }

    if (httpError?.status === 410 || (httpError?.status === 400 && this.looksExpired(normalized))) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('expired-token');
      } else {
        this.applyLocalFailureState('expired-token');
      }
      return;
    }

    if (
      httpError?.status === 400 &&
      (normalized.includes('missing token') || normalized.includes('nedostaje token'))
    ) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('missing-token');
      } else {
        this.applyLocalFailureState('missing-token');
      }
      return;
    }

    if (httpError?.status && httpError.status >= 500) {
      if (isPlatformBrowser(this.platformId)) {
        this.redirectToFailure('backend-error');
      } else {
        this.applyLocalFailureState('backend-error');
      }
      return;
    }

    if (isPlatformBrowser(this.platformId)) {
      this.redirectToFailure('verification-failed');
      return;
    }

    this.applyLocalFailureState('verification-failed');
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
      const parsed = new URL(url, this.config.siteUrl);
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

  private failureReasonFromQuery(): VerificationFailedReason | null {
    const query = this.route.snapshot.queryParamMap;

    const tokenExpired = this.normalizeText(query.get('tokenExpired'));
    if (tokenExpired === '1' || tokenExpired === 'true' || tokenExpired === 'yes') {
      return 'expired-token';
    }

    return this.failureReasonFromCombinedText(
      this.normalizeText(
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
      ),
    );
  }

  private failureReasonFromUrl(url: string | null): VerificationFailedReason | null {
    if (!url) return null;

    try {
      const parsed = new URL(url, this.config.siteUrl);
      const tokenExpired = this.normalizeText(parsed.searchParams.get('tokenExpired'));
      if (tokenExpired === '1' || tokenExpired === 'true' || tokenExpired === 'yes') {
        return 'expired-token';
      }

      return this.failureReasonFromCombinedText(
        this.normalizeText(
          [
            parsed.pathname,
            parsed.searchParams.get('reason'),
            parsed.searchParams.get('status'),
            parsed.searchParams.get('error'),
            parsed.searchParams.get('errorCode'),
            parsed.searchParams.get('code'),
            parsed.searchParams.get('message'),
          ]
            .filter(Boolean)
            .join(' '),
        ),
      );
    } catch {
      return null;
    }
  }

  private failureReasonFromCombinedText(combined: string): VerificationFailedReason | null {
    if (!combined) return null;

    if (this.looksExpired(combined)) return 'expired-token';
    if (combined.includes('deliver') || combined.includes('isporuc')) return 'already-delivered';
    if (combined.includes('reject') || combined.includes('odbij') || combined.includes('otkaz')) {
      return 'rejected';
    }
    if (this.looksAlreadyConfirmed(combined)) return 'already-verified';

    if (
      combined.includes('missing token') ||
      combined.includes('missing-token') ||
      combined.includes('token missing') ||
      combined.includes('nedostaje token')
    ) {
      return 'missing-token';
    }

    if (this.looksInvalid(combined)) return 'invalid-token';

    if (combined.includes('backend') || combined.includes('server') || combined.includes('500')) {
      return 'backend-error';
    }

    if (combined.includes('failed') || combined.includes('error') || combined.includes('gresk')) {
      return 'verification-failed';
    }

    return null;
  }

  private reasonFromState(state: OrderVerifyState | null): VerificationFailedReason | null {
    if (state === 'expired') return 'expired-token';
    if (state === 'invalid') return 'invalid-token';
    return null;
  }

  private applyLocalFailureState(reason: VerificationFailedReason): void {
    if (reason === 'expired-token') {
      this.state.set('expired');
      this.details.set(
        'Link za potvrdu izmjena je istekao. Kontaktirajte prodavca za dalje informacije.',
      );
      return;
    }

    if (reason === 'already-verified') {
      this.state.set('invalid');
      this.details.set('Izmjene narudžbe su već potvrđene i ovaj link više nije aktivan.');
      return;
    }

    if (reason === 'already-delivered') {
      this.state.set('invalid');
      this.details.set('Narudžba je već kompletirana i izmjene nije moguće ponovo potvrditi.');
      return;
    }

    if (reason === 'rejected') {
      this.state.set('invalid');
      this.details.set('Izmjene nisu prihvaćene, pa je narudžba otkazana.');
      return;
    }

    if (reason === 'missing-token') {
      this.state.set('invalid');
      this.details.set('Nedostaje token za potvrdu izmjena narudžbe.');
      return;
    }

    if (reason === 'backend-error') {
      this.state.set('invalid');
      this.details.set('Potvrda izmjena trenutno nije dostupna. Pokušajte ponovo kasnije.');
      return;
    }

    this.state.set('invalid');
    this.details.set('Link za potvrdu izmjena nije važeći ili je već iskorišten.');
  }

  private redirectToFailure(reason: VerificationFailedReason): void {
    const queryParams: Record<string, string | boolean> = { reason };
    if (reason === 'expired-token') {
      queryParams['tokenExpired'] = true;
    }

    void this.router
      .navigate(['/order/verification-failed'], {
        queryParams,
        replaceUrl: true,
      })
      .catch(() => {
        this.applyLocalFailureState(reason);
      });
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
      value.includes('already performed') ||
      value.includes('already-processed') ||
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
