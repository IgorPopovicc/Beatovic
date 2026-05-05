import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { NewsletterApiService } from '../../../core/api/newsletter-api.service';
import { AppNoticeService } from '../../../core/system/app-notice.service';

function hasVisibleText(value: string): boolean {
  return String(value ?? '').trim().length > 0;
}

@Component({
  selector: 'app-home-newsletter',
  imports: [ReactiveFormsModule],
  templateUrl: './home-newsletter.html',
  styleUrl: './home-newsletter.scss',
})
export class HomeNewsletter {
  private readonly fb = inject(FormBuilder);
  private readonly newsletterApi = inject(NewsletterApiService);
  private readonly notices = inject(AppNoticeService);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    privacyPolicyAccepted: [false, [Validators.requiredTrue]],
  });

  submit(): void {
    if (this.submitting()) return;

    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submitError.set(null);
          this.form.reset({ email: '', privacyPolicyAccepted: false });
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.notices.success(
            'Uspješno ste prijavljeni na newsletter.',
            'Nakon potvrde dobit ćete jedinstveni kod za 10% popusta na email.',
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
