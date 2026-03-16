import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AttributeDTO, AttributeValueDTO } from './admin-products.models';

type RawAttributeDTO = Partial<AttributeDTO> & {
  id?: string;
  name?: string | null;
  displayValue?: string | null;
  value?: string | null;
};

type RawAttributeValueDTO = Partial<AttributeValueDTO> & {
  id?: string;
  value?: string | null;
  displayValue?: string | null;
  parent?: { id?: string; value?: string | null; displayValue?: string | null } | null;
};

function normalizeAttribute(raw: RawAttributeDTO): AttributeDTO | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const canonicalName = String(raw?.name ?? raw?.value ?? '').trim();
  const displayValue = String(raw?.displayValue ?? '').trim() || undefined;
  const name = canonicalName || displayValue || '';
  if (!name) return null;

  return { id, name, displayValue };
}

function normalizeAttributeValue(raw: RawAttributeValueDTO): AttributeValueDTO | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const canonicalValue = String(raw?.value ?? '').trim();
  const displayValue = String(raw?.displayValue ?? '').trim() || undefined;
  const value = canonicalValue || displayValue || '';
  if (!value) return null;

  const parent = raw?.parent
    ? {
        id: String(raw.parent.id ?? '').trim() || undefined,
        value: String(raw.parent.value ?? '').trim() || undefined,
        displayValue: String(raw.parent.displayValue ?? '').trim() || undefined,
      }
    : null;

  return { id, value, displayValue, parent };
}

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

    return this.http.get<RawAttributeDTO[]>(url, { headers }).pipe(
      map((items) =>
        (items ?? [])
          .map(normalizeAttribute)
          .filter((item): item is AttributeDTO => item !== null),
      ),
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

    return this.http.get<RawAttributeValueDTO[]>(url, { headers }).pipe(
      map((items) =>
        (items ?? [])
          .map(normalizeAttributeValue)
          .filter((item): item is AttributeValueDTO => item !== null),
      ),
      catchError((err) => {
        console.error('[AdminAttributesApi] getAttributeValues failed:', err);
        return throwError(() => err);
      }),
    );
  }
}
