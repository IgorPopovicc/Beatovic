import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { CouponDetails } from '../admin-api/admin-coupons.models';

export type CheckoutCouponDiscountType = CouponDetails['discountType'];

export interface CheckoutCoupon
  extends Omit<
    Pick<CouponDetails, 'id' | 'code' | 'discountType' | 'discountValue' | 'remainingUsageCount'>,
    'remainingUsageCount'
  > {
  remainingUsageCount: number | null;
}

export type CouponLookupResult =
  | { status: 'valid'; coupon: CheckoutCoupon }
  | { status: 'not_found' }
  | { status: 'exhausted' }
  | { status: 'auth_protected' }
  | { status: 'unavailable' };

type RawCoupon = Partial<Record<string, unknown>>;

function asRawCouponArray(response: unknown): RawCoupon[] {
  if (Array.isArray(response)) return response as RawCoupon[];

  if (response && typeof response === 'object') {
    const objectResponse = response as Record<string, unknown>;

    if (Array.isArray(objectResponse['content'])) {
      return objectResponse['content'] as RawCoupon[];
    }

    return [objectResponse];
  }

  return [];
}

function normalizeDiscountType(raw: unknown): CheckoutCouponDiscountType | null {
  const normalized = String(raw ?? '').trim().toUpperCase();
  if (normalized === 'PERCENTAGE') return 'PERCENTAGE';
  if (normalized === 'FIXED_AMOUNT') return 'FIXED_AMOUNT';
  return null;
}

function normalizeCoupon(raw: RawCoupon): CheckoutCoupon | null {
  const id = String(raw['id'] ?? '').trim() || String(raw['couponId'] ?? '').trim();
  const code = String(raw['code'] ?? raw['couponCode'] ?? '').trim();
  const discountType = normalizeDiscountType(raw['discountType'] ?? raw['couponType']);
  const discountValue = Number(raw['discountValue'] ?? raw['couponValue'] ?? 0);

  if (!code || !discountType) return null;
  if (!Number.isFinite(discountValue) || discountValue <= 0) return null;

  const remainingUsageCountRaw = raw['remainingUsageCount'];
  const remainingUsageCount =
    remainingUsageCountRaw === undefined || remainingUsageCountRaw === null
      ? null
      : Number(remainingUsageCountRaw);

  return {
    id: id || code,
    code,
    discountType,
    discountValue,
    remainingUsageCount:
      remainingUsageCount !== null && Number.isFinite(remainingUsageCount)
        ? remainingUsageCount
        : null,
  };
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

@Injectable({ providedIn: 'root' })
export class CouponsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/admin/coupons/active`;

  lookupCouponByCode(code: string): Observable<CouponLookupResult> {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) return of({ status: 'not_found' });

    return this.http.get<unknown>(this.endpoint).pipe(
      map((response) => {
        const coupons = asRawCouponArray(response)
          .map((item) => normalizeCoupon(item))
          .filter((item): item is CheckoutCoupon => item !== null);

        const coupon = coupons.find((item) => normalizeCode(item.code) === normalizedCode);
        if (!coupon) return { status: 'not_found' } satisfies CouponLookupResult;

        if (coupon.remainingUsageCount !== null && coupon.remainingUsageCount <= 0) {
          return { status: 'exhausted' } satisfies CouponLookupResult;
        }

        return { status: 'valid', coupon } satisfies CouponLookupResult;
      }),
      catchError((error: unknown) => {
        const status = Number((error as { status?: unknown })?.status ?? 0);

        if (status === 401 || status === 403) {
          return of({ status: 'auth_protected' } satisfies CouponLookupResult);
        }

        return of({ status: 'unavailable' } satisfies CouponLookupResult);
      }),
    );
  }
}
