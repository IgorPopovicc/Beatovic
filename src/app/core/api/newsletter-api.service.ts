import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export interface NewsletterSubscribeRequest {
  email: string;
  privacyPolicyAccepted: boolean;
}

@Injectable({ providedIn: 'root' })
export class NewsletterApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/newsletter/subscribe`;

  subscribe(body: NewsletterSubscribeRequest): Observable<string> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http
      .post(this.endpoint, body, {
        headers,
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        map((response) => String(response.body ?? '').trim()),
        catchError((err) => throwError(() => err)),
      );
  }
}
