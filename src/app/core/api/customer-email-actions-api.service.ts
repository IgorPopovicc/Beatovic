import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { runtimeApiUrl } from '../config/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class CustomerEmailActionsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = runtimeApiUrl('');

  unsubscribeNewsletter(token: string): Observable<string> {
    const safeToken = encodeURIComponent(token.trim());
    return this.http.get(`${this.baseUrl}/newsletter/unsubscribe/${safeToken}`, {
      responseType: 'text',
    });
  }

  verifyOrderEmail(token: string): Observable<HttpResponse<string>> {
    const safeToken = encodeURIComponent(token.trim());
    return this.http.get(`${this.baseUrl}/orders/verify/${safeToken}`, {
      observe: 'response',
      responseType: 'text',
    });
  }
}
