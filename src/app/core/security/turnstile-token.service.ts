import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type TurnstileContext = 'admin-login' | 'newsletter' | 'contact' | 'checkout';

const EMPTY_TOKENS: Record<TurnstileContext, string | null> = {
  'admin-login': null,
  newsletter: null,
  contact: null,
  checkout: null,
};

@Injectable({ providedIn: 'root' })
export class TurnstileTokenService {
  private readonly tokenState = signal<Record<TurnstileContext, string | null>>(EMPTY_TOKENS);
  private readonly resetSubject = new Subject<TurnstileContext>();

  readonly resetRequests$ = this.resetSubject.asObservable();

  token(context: TurnstileContext): string | null {
    return this.tokenState()[context];
  }

  hasToken(context: TurnstileContext): boolean {
    return !!this.token(context);
  }

  setToken(context: TurnstileContext, token: string): void {
    const normalized = String(token ?? '').trim();
    this.tokenState.update((current) => ({ ...current, [context]: normalized || null }));
  }

  invalidate(context: TurnstileContext): void {
    this.tokenState.update((current) => ({ ...current, [context]: null }));
  }

  reset(context: TurnstileContext): void {
    this.invalidate(context);
    this.resetSubject.next(context);
  }
}
