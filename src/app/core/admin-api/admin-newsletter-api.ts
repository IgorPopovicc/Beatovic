import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { runtimeApiUrl } from '../config/runtime-config.service';
import { AuthService } from '../auth/auth.service';
import {
  NewsletterSubscription,
  NewsletterSubscriptionsQuery,
  PagedResult,
} from './admin-newsletter.models';

type RawNewsletterSubscription = Partial<NewsletterSubscription>;

function stringOrNull(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return null;
}

function normalizeSubscription(
  raw: RawNewsletterSubscription | null | undefined,
): NewsletterSubscription | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id;
  const email = String(raw.email ?? '').trim();
  const subscribedAt =
    stringOrNull(raw.subscribedAt) ?? stringOrNull(raw.createdAt) ?? stringOrNull(raw.updatedAt) ?? '';

  if ((typeof id !== 'string' && typeof id !== 'number') || !email) {
    return null;
  }

  return {
    id,
    email,
    subscribedAt,
    status: stringOrNull(raw.status),
    active: booleanOrNull(raw.active),
    createdAt: stringOrNull(raw.createdAt),
    updatedAt: stringOrNull(raw.updatedAt),
  };
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePagedResult(
  response: unknown,
  query: NewsletterSubscriptionsQuery,
): PagedResult<NewsletterSubscription> {
  const fallback: PagedResult<NewsletterSubscription> = {
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: query.page,
    size: query.size,
    numberOfElements: 0,
    first: query.page <= 0,
    last: true,
    empty: true,
  };

  if (Array.isArray(response)) {
    const content = response
      .map((item) => normalizeSubscription(item as RawNewsletterSubscription))
      .filter((item): item is NewsletterSubscription => item !== null);

    return {
      ...fallback,
      content,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
      numberOfElements: content.length,
      empty: content.length === 0,
    };
  }

  if (!response || typeof response !== 'object') {
    return fallback;
  }

  const record = response as Record<string, unknown>;
  const contentRaw = Array.isArray(record['content'])
    ? record['content']
    : Array.isArray(record['items'])
      ? record['items']
      : Array.isArray(record['data'])
        ? record['data']
        : [];

  let content = contentRaw
    .map((item) => normalizeSubscription(item as RawNewsletterSubscription))
    .filter((item): item is NewsletterSubscription => item !== null);

  if (content.length === 0) {
    const single = normalizeSubscription(record as RawNewsletterSubscription);
    if (single) {
      content = [single];
    }
  }

  const totalElements = numberOrDefault(record['totalElements'], content.length);
  const totalPages = numberOrDefault(record['totalPages'], totalElements > 0 ? 1 : 0);
  const number = numberOrDefault(record['number'], query.page);
  const size = numberOrDefault(record['size'], query.size);
  const numberOfElements = numberOrDefault(record['numberOfElements'], content.length);

  return {
    content,
    totalElements,
    totalPages,
    number,
    size,
    numberOfElements,
    first: Boolean(record['first'] ?? number <= 0),
    last: Boolean(record['last'] ?? number + 1 >= Math.max(totalPages, 1)),
    empty: Boolean(record['empty'] ?? content.length === 0),
  };
}

@Injectable({ providedIn: 'root' })
export class AdminNewsletterApi {
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

  getActiveSubscriptions(
    query: NewsletterSubscriptionsQuery,
  ): Observable<PagedResult<NewsletterSubscription>> {
    let headers: HttpHeaders;

    try {
      headers = this.headersOrThrow();
    } catch (err) {
      return throwError(() => err);
    }

    let params = new HttpParams()
      .set('page', String(query.page))
      .set('size', String(query.size));

    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }

    const sortValues = Array.isArray(query.sort)
      ? query.sort.filter((value) => String(value).trim().length > 0)
      : String(query.sort ?? '').trim()
        ? [String(query.sort).trim()]
        : [];

    for (const sortValue of sortValues) {
      params = params.append('sort', sortValue);
    }

    return this.http
      .get<unknown>(runtimeApiUrl(`/newsletter/admin/subscriptions`), {
        headers,
        params,
      })
      .pipe(
        map((response) => normalizePagedResult(response, query)),
        catchError((err) => {
          console.error('[AdminNewsletterApi] getActiveSubscriptions failed:', err);
          return throwError(() => err);
        }),
      );
  }
}
