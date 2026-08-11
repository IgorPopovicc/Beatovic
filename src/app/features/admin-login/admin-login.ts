import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { finalize } from 'rxjs/operators';
import { TurnstileWidgetComponent } from '../../shared/ui/turnstile-widget/turnstile-widget';
import { TurnstileTokenService } from '../../core/security/turnstile-token.service';
import { isTurnstileVerificationError } from '../../core/security/turnstile.interceptor';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgOptimizedImage, TurnstileWidgetComponent],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
})
export class AdminLogin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly turnstile = inject(TurnstileTokenService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly loginError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: this.fb.nonNullable.control('', Validators.required),
    password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(4)]),
  });

  readonly formStatus = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), {
    initialValue: this.form.status,
  });

  readonly invalid = computed(
    () =>
      this.formStatus() !== 'VALID' ||
      this.loading() ||
      !this.turnstile.hasToken('admin-login'),
  );
  readonly passwordInputType = computed(() => (this.showPassword() ? 'text' : 'password'));

  ngOnInit(): void {
    if (this.auth.hasValidToken() && this.auth.hasRole('ADMIN')) {
      void this.router.navigateByUrl('/admin/panel');
    }
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  submit(): void {
    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.loginError.set(null);

    const { username, password } = this.form.getRawValue();

    this.auth
      .login(username, password)
      .pipe(finalize(() => this.turnstile.reset('admin-login')))
      .subscribe({
      next: () => {
        this.loading.set(false);

        void this.router.navigateByUrl('/admin/panel');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loginError.set(
          isTurnstileVerificationError(error)
            ? 'Sigurnosna provjera nije uspjela. Molimo pokušajte ponovo.'
            : 'Greška pri prijavi. Pokušajte ponovo.',
        );
      },
      });
  }
}
