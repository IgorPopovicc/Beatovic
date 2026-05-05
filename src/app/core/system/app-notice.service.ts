import { Injectable, signal } from '@angular/core';

export type AppNoticeKind = 'success' | 'error' | 'info';

export interface AppNotice {
  id: number;
  kind: AppNoticeKind;
  title: string;
  subtitle?: string;
}

@Injectable({ providedIn: 'root' })
export class AppNoticeService {
  private readonly lastNoticeSig = signal<AppNotice | null>(null);

  readonly lastNotice = this.lastNoticeSig.asReadonly();

  success(title: string, subtitle?: string): void {
    this.push('success', title, subtitle);
  }

  error(title: string, subtitle?: string): void {
    this.push('error', title, subtitle);
  }

  info(title: string, subtitle?: string): void {
    this.push('info', title, subtitle);
  }

  private push(kind: AppNoticeKind, title: string, subtitle?: string): void {
    this.lastNoticeSig.set({
      id: Date.now(),
      kind,
      title: String(title ?? '').trim(),
      subtitle: String(subtitle ?? '').trim() || undefined,
    });
  }
}
