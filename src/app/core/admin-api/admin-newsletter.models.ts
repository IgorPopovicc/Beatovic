export interface NewsletterSubscription {
  id: string | number;
  email: string;
  subscribedAt: string;
  status?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PagedResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface NewsletterSubscriptionsQuery {
  q?: string;
  page: number;
  size: number;
  sort?: string | string[];
}
