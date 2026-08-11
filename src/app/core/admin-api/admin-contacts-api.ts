import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { runtimeApiUrl } from '../config/runtime-config.service';
import { AuthService } from '../auth/auth.service';
import { ContactMessage, ContactSearchRequest } from './admin-contacts.models';

type RawContactMessage = Partial<ContactMessage>;

function normalizeContactMessage(raw: RawContactMessage | null | undefined): ContactMessage | null {
  const email = String(raw?.email ?? '').trim();
  const message = String(raw?.message ?? '').trim();
  const submittedAt = String(raw?.submittedAt ?? '').trim();

  if (!email || !message) return null;

  return {
    name: String(raw?.name ?? '').trim(),
    email,
    subject: String(raw?.subject ?? '').trim(),
    message,
    phoneNumber: String(raw?.phoneNumber ?? '').trim(),
    submittedAt,
  };
}

@Injectable({ providedIn: 'root' })
export class AdminContactsApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private headersOrThrow(): HttpHeaders | never {
    const token = this.auth.accessToken();
    if (!token) throw new Error('Nema tokena. Prijavite se kao admin.');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  searchContacts(body: ContactSearchRequest): Observable<ContactMessage[]> {
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (err) {
      return throwError(() => err);
    }

    return this.http
      .post<unknown>(runtimeApiUrl(`/contact/admin/search`), body, { headers })
      .pipe(
        map((response) => {
          const items = Array.isArray(response) ? response : [];
          return items
            .map((item) => normalizeContactMessage(item as RawContactMessage))
            .filter((item): item is ContactMessage => item !== null);
        }),
        catchError((err) => {
          console.error('[AdminContactsApi] searchContacts failed:', err);
          return throwError(() => err);
        }),
      );
  }
}
