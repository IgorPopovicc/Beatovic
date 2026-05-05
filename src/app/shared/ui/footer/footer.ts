import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ContactFormApiService } from '../../../core/api/contact-form-api.service';
import { AppNoticeService } from '../../../core/system/app-notice.service';

const PHONE_REGEX = /^\+?[0-9\-\s]{7,15}$/;

function hasVisibleText(value: string): boolean {
  return String(value ?? '').trim().length > 0;
}

@Component({
  selector: 'app-footer',
  imports: [ReactiveFormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly contactApi = inject(ContactFormApiService);
  private readonly notices = inject(AppNoticeService);
  private bodyOverflowBeforeModal: string | null = null;

  readonly contactOpen = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(20)]],
    phoneNumber: ['', [Validators.pattern(PHONE_REGEX)]],
    subject: ['', [Validators.maxLength(30)]],
    message: ['', [Validators.required, Validators.maxLength(1000)]],
    privacyPolicyAccepted: [false, [Validators.requiredTrue]],
  });

  scrollTo(fragment: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const element = this.document.getElementById(fragment);
    element?.scrollIntoView({ behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  openContactModal(): void {
    this.contactOpen.set(true);
    this.submitError.set(null);
    this.lockBodyScroll();
  }

  closeContactModal(): void {
    if (this.submitting()) return;
    this.contactOpen.set(false);
    this.submitError.set(null);
    this.unlockBodyScroll();
  }

  onBackdropClick(): void {
    this.closeContactModal();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.contactOpen()) return;
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.closeContactModal();
  }

  submitContactMessage(): void {
    if (this.submitting()) return;

    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const email = String(raw.email ?? '').trim();
    const message = String(raw.message ?? '').trim();

    if (!hasVisibleText(email) || !hasVisibleText(message)) {
      this.form.markAllAsTouched();
      this.submitError.set('Unesite e-mail i poruku.');
      return;
    }

    const payload = {
      email,
      message,
      privacyPolicyAccepted: true,
      ...(hasVisibleText(raw.name) ? { name: String(raw.name).trim() } : {}),
      ...(hasVisibleText(raw.phoneNumber) ? { phoneNumber: String(raw.phoneNumber).trim() } : {}),
      ...(hasVisibleText(raw.subject) ? { subject: String(raw.subject).trim() } : {}),
    };

    this.submitting.set(true);

    this.contactApi
      .submitMessage(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.submitError.set(null);
          this.resetForm();
          this.closeContactModal();
          this.notices.success('Poruka je uspješno poslata.');
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
      case 'name':
        if (control.errors?.['maxlength']) return 'Ime može imati najviše 30 karaktera.';
        return 'Unesite ispravno ime.';
      case 'email':
        if (control.errors?.['required']) return 'E-mail je obavezan.';
        if (control.errors?.['email']) return 'Unesite ispravan e-mail.';
        if (control.errors?.['maxlength']) return 'E-mail može imati najviše 20 karaktera.';
        return 'Unesite ispravan e-mail.';
      case 'phoneNumber':
        if (control.errors?.['pattern']) return 'Telefon mora biti u formatu +387 61 123 456.';
        return 'Unesite ispravan broj telefona.';
      case 'subject':
        if (control.errors?.['maxlength']) return 'Naslov može imati najviše 30 karaktera.';
        return 'Unesite ispravan naslov.';
      case 'message':
        if (control.errors?.['required']) return 'Poruka je obavezna.';
        if (control.errors?.['maxlength']) return 'Poruka može imati najviše 1000 karaktera.';
        return 'Unesite ispravnu poruku.';
      case 'privacyPolicyAccepted':
        return 'Morate prihvatiti politiku privatnosti.';
      default:
        return '';
    }
  }

  hasFieldError(controlName: keyof typeof this.form.controls): boolean {
    return this.fieldError(controlName).length > 0;
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      email: '',
      phoneNumber: '',
      subject: '',
      message: '',
      privacyPolicyAccepted: false,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private userErrorMessage(error: unknown): string {
    const status = Number((error as { status?: unknown })?.status ?? 0);
    if (status === 400 || status === 422) {
      const backendEmailError = String(
        ((error as { error?: Record<string, unknown> })?.error ?? {})['email'] ?? '',
      ).toLowerCase();

      if (backendEmailError.includes('between 0 and 20') || backendEmailError.includes('20')) {
        return 'E-mail može imati najviše 20 karaktera.';
      }

      return 'Provjerite unesene podatke i pokušajte ponovo.';
    }

    return 'Poruka trenutno nije poslana. Pokušajte ponovo kasnije.';
  }

  private lockBodyScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const body = this.document.body;
    if (!body) return;

    if (this.bodyOverflowBeforeModal === null) {
      this.bodyOverflowBeforeModal = body.style.overflow;
    }

    body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const body = this.document.body;
    if (!body) return;

    if (this.bodyOverflowBeforeModal !== null) {
      body.style.overflow = this.bodyOverflowBeforeModal;
      this.bodyOverflowBeforeModal = null;
    }
  }
}
