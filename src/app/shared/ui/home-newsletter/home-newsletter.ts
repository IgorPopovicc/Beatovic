import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { NewsletterApiService } from '../../../core/api/newsletter-api.service';
import { AppNoticeService } from '../../../core/system/app-notice.service';
import { RouterLink } from '@angular/router';
import { TurnstileWidgetComponent } from '../turnstile-widget/turnstile-widget';
import { TurnstileTokenService } from '../../../core/security/turnstile-token.service';
import { isTurnstileVerificationError } from '../../../core/security/turnstile.interceptor';

function hasVisibleText(value: string): boolean {
  return String(value ?? '').trim().length > 0;
}

@Component({
  selector: 'app-home-newsletter',
  imports: [ReactiveFormsModule, RouterLink, TurnstileWidgetComponent],
  templateUrl: './home-newsletter.html',
  styleUrl: './home-newsletter.scss',
})
export class HomeNewsletter {
  private readonly fb = inject(FormBuilder);
  private readonly newsletterApi = inject(NewsletterApiService);
  private readonly notices = inject(AppNoticeService);
  readonly turnstile = inject(TurnstileTokenService);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    privacyPolicyAccepted: [false, [Validators.requiredTrue]],
    website: [''],
  });

  submit(): void {
    if (this.submitting()) return;

    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.turnstile.hasToken('newsletter')) {
      this.submitError.set('Potvrdite sigurnosnu provjeru prije slanja.');
      return;
    }

    const raw = this.form.getRawValue();
    const email = String(raw.email ?? '').trim();
    if (!hasVisibleText(email)) {
      this.form.markAllAsTouched();
      this.submitError.set('Unesite e-mail adresu.');
      return;
    }

    this.submitting.set(true);
    this.newsletterApi
      .subscribe({
        email,
        privacyPolicyAccepted: true,
        website: String(raw.website ?? ''),
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.turnstile.reset('newsletter');
        }),
      )
      .subscribe({
        next: () => {
          this.submitError.set(null);
          this.form.reset({ email: '', privacyPolicyAccepted: false, website: '' });
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.notices.success(
            'Poslali smo vam email sa linkom za potvrdu.',
            'Molimo provjerite inbox (i spam folder).',
          );
        },
        error: (err: unknown) => {
          this.submitError.set(this.userErrorMessage(err));
        },
      });
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) return '';

    switch (controlName) {
      case 'email':
        if (control.errors?.['required']) return 'E-mail je obavezan.';
        if (control.errors?.['email']) return 'Unesite ispravan e-mail.';
        if (control.errors?.['maxlength']) return 'E-mail može imati najviše 120 karaktera.';
        return 'Unesite ispravan e-mail.';
      case 'privacyPolicyAccepted':
        return 'Morate prihvatiti politiku privatnosti.';
      default:
        return '';
    }
  }

  hasFieldError(controlName: keyof typeof this.form.controls): boolean {
    return this.fieldError(controlName).length > 0;
  }

  private userErrorMessage(error: unknown): string {
    if (isTurnstileVerificationError(error)) {
      return 'Sigurnosna provjera nije uspjela. Molimo pokušajte ponovo.';
    }
    const status = Number((error as { status?: unknown })?.status ?? 0);
    if (status === 400 || status === 422) {
      return 'Provjerite unesene podatke i pokušajte ponovo.';
    }

    if (status === 409) {
      return 'Ova e-mail adresa je već prijavljena na newsletter.';
    }

    return 'Newsletter prijava trenutno nije dostupna. Pokušajte ponovo kasnije.';
  }
}
