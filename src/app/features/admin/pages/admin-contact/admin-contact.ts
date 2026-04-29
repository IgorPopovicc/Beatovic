import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, startWith, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { AdminContactsApi } from '../../../../core/admin-api/admin-contacts-api';
import { ContactMessage, ContactSearchRequest } from '../../../../core/admin-api/admin-contacts.models';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalDatetimeValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDatetimeToIso(value: string): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

@Component({
  selector: 'app-admin-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-contact.html',
  styleUrl: './admin-contact.scss',
})
export class AdminContact {
  private readonly api = inject(AdminContactsApi);

  readonly email = new FormControl<string>('', { nonNullable: true });
  readonly fromDate = new FormControl<string>('', { nonNullable: true });
  readonly toDate = new FormControl<string>('', { nonNullable: true });

  readonly emailSig = toSignal(this.email.valueChanges.pipe(startWith(this.email.value)), {
    initialValue: this.email.value,
  });
  readonly fromDateSig = toSignal(this.fromDate.valueChanges.pipe(startWith(this.fromDate.value)), {
    initialValue: this.fromDate.value,
  });
  readonly toDateSig = toSignal(this.toDate.valueChanges.pipe(startWith(this.toDate.value)), {
    initialValue: this.toDate.value,
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly messages = signal<ContactMessage[]>([]);

  readonly hasResults = computed(() => this.messages().length > 0);

  readonly normalizedFrom = computed(() => String(this.fromDateSig() ?? '').trim());
  readonly normalizedTo = computed(() => String(this.toDateSig() ?? '').trim());

  readonly hasDateRange = computed(() => !!this.normalizedFrom() && !!this.normalizedTo());

  readonly validDateRange = computed(() => {
    if (!this.hasDateRange()) return false;
    return this.normalizedFrom() <= this.normalizedTo();
  });

  readonly showDateRangeError = computed(() => this.hasDateRange() && !this.validDateRange());

  readonly canSearch = computed(() => !this.loading() && !this.showDateRangeError());

  ngOnInit(): void {
    this.applyDefaultRange();
    this.search();
  }

  applyDefaultRange(): void {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 30);

    this.fromDate.setValue(toLocalDatetimeValue(from));
    this.toDate.setValue(toLocalDatetimeValue(now));
  }

  search(): void {
    this.error.set(null);

    if (this.showDateRangeError()) {
      this.error.set('Start datum mora biti manji ili jednak end datumu.');
      return;
    }

    const payload = this.buildPayload();

    this.loading.set(true);

    this.api
      .searchContacts(payload)
      .pipe(
        tap((list) => {
          const sorted = (list ?? [])
            .slice()
            .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

          this.messages.set(sorted);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.messages.set([]);

          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju kontakt poruka. Pokušajte ponovo.';

          this.error.set(msg);
          return of([]);
        }),
      )
      .subscribe();
  }

  resetToLast30Days(): void {
    this.applyDefaultRange();
    this.search();
  }

  formatDateTime(value: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('bs-BA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  trackByIndex(index: number): number {
    return index;
  }

  private buildPayload(): ContactSearchRequest {
    const email = String(this.emailSig() ?? '').trim();
    const fromIso = localDatetimeToIso(this.normalizedFrom());
    const toIso = localDatetimeToIso(this.normalizedTo());

    const payload: ContactSearchRequest = {};

    if (email) payload.email = email;
    if (fromIso) payload.fromDate = fromIso;
    if (toIso) payload.toDate = toIso;

    return payload;
  }
}
