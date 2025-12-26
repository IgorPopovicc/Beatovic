export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface DiscountListItem {
  id: string;
  type: DiscountType;
  value: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  description: string;
}

export interface CreateDiscountRequest {
  type: DiscountType;
  value: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  description: string;
  variantIds: string[]; // trenutno []
}

export interface UpdateDiscountRequest extends CreateDiscountRequest {
  id: string;
}
