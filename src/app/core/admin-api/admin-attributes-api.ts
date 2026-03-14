import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AttributeDTO, AttributeValueDTO } from './admin-products.models';

@Injectable({ providedIn: 'root' })
export class AdminAttributesApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  getAttributes(): Observable<AttributeDTO[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const url = `${environment.apiBaseUrl}/attributes`;

    return this.http.get<AttributeDTO[]>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminAttributesApi] getAttributes failed:', err);
        return throwError(() => err);
      }),
    );
  }

  getAttributeValues(attributeId: string): Observable<AttributeValueDTO[]> {
    const token = this.auth.accessToken();
    if (!token) return throwError(() => new Error('Nema tokena. Prijavite se kao admin.'));

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const url = `${environment.apiBaseUrl}/attributes/${encodeURIComponent(attributeId)}/values`;

    return this.http.get<AttributeValueDTO[]>(url, { headers }).pipe(
      catchError((err) => {
        console.error('[AdminAttributesApi] getAttributeValues failed:', err);
        return throwError(() => err);
      }),
    );
  }
}
