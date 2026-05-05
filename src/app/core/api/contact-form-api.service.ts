import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { CreateContactMessageRequest } from '../admin-api/admin-contacts.models';

@Injectable({ providedIn: 'root' })
export class ContactFormApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/contact/add`;

  submitMessage(body: CreateContactMessageRequest): Observable<void> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http
      .post(this.endpoint, body, {
        headers,
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        map(() => void 0),
        catchError((err) => throwError(() => err)),
      );
  }
}
