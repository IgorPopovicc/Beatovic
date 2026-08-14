import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { runtimeApiUrl } from '../config/runtime-config.service';
import { AuthService } from '../auth/auth.service';
import { CouponDetails, CreateCouponRequest } from './admin-coupons.models';

type RawCouponDetails = Partial<CouponDetails>;

function normalizeUsageType(value: unknown): CouponDetails['usageType'] | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  if (normalized === 'GLOBAL_LIMIT' || normalized === 'SINGLE_USE') return 'GLOBAL_LIMIT';
  if (normalized === 'LIMIT_PER_USER' || normalized === 'PER_USER') return 'LIMIT_PER_USER';
  return null;
}

function normalizeCoupon(raw: RawCouponDetails | null | undefined): CouponDetails | null {
  const id = String(raw?.id ?? '').trim();
  const code = String(raw?.code ?? '').trim();
  const discountType = String(raw?.discountType ?? '').trim();
  const usageType = normalizeUsageType(raw?.usageType);

  if (!id || !code) return null;
  if (discountType !== 'PERCENTAGE' && discountType !== 'FIXED_AMOUNT') return null;
  if (!usageType) return null;

  return {
    id,
    code,
    discountType,
    usageType,
    discountValue: Number(raw?.discountValue ?? 0),
    maxUsageCount: Number(raw?.maxUsageCount ?? 0),
    remainingUsageCount: Number(raw?.remainingUsageCount ?? 0),
  };
}

function toRawCouponArray(response: unknown): RawCouponDetails[] {
  if (Array.isArray(response)) return response as RawCouponDetails[];

  if (response && typeof response === 'object') {
    const objectResponse = response as Record<string, unknown>;

    if (Array.isArray(objectResponse['content'])) {
      return objectResponse['content'] as RawCouponDetails[];
    }

    const single = normalizeCoupon(objectResponse as RawCouponDetails);
    if (single) return [single];
  }

  return [];
}

@Injectable({ providedIn: 'root' })
export class AdminCouponsApi {
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

  getActiveCoupons(): Observable<CouponDetails[]> {
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (err) {
      return throwError(() => err);
    }

    return this.http.get<unknown>(runtimeApiUrl(`/coupons/admin/active`), { headers }).pipe(
      map((response) =>
        toRawCouponArray(response)
          .map((item) => normalizeCoupon(item))
          .filter((item): item is CouponDetails => item !== null),
      ),
      catchError((err) => {
        console.error('[AdminCouponsApi] getActiveCoupons failed:', err);
        return throwError(() => err);
      }),
    );
  }

  createCoupon(body: CreateCouponRequest): Observable<CouponDetails> {
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (err) {
      return throwError(() => err);
    }

    return this.http.post<unknown>(runtimeApiUrl(`/coupons/admin`), body, { headers }).pipe(
      map((response) => {
        const normalized = normalizeCoupon(response as RawCouponDetails);
        if (!normalized) {
          throw new Error('Neočekivan odgovor backend-a za kupon.');
        }
        return normalized;
      }),
      catchError((err) => {
        console.error('[AdminCouponsApi] createCoupon failed:', err);
        return throwError(() => err);
      }),
    );
  }

  deactivateCoupon(couponId: string): Observable<void> {
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (err) {
      return throwError(() => err);
    }

    const safeId = encodeURIComponent(couponId);
    return this.http
      .delete(runtimeApiUrl(`/coupons/admin/${safeId}`), {
        headers,
        responseType: 'text',
      })
      .pipe(
        map(() => void 0),
        catchError((err) => {
          console.error('[AdminCouponsApi] deactivateCoupon failed:', err);
          return throwError(() => err);
        }),
      );
  }
}
