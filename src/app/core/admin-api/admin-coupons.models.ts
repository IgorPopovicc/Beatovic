export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponUsageType = 'SINGLE_USE' | 'PER_USER';

export interface CreateCouponRequest {
  code: string;
  discountValue: number;
  discountType: CouponDiscountType;
  usageType: CouponUsageType;
  maxUsageCount: number;
}

export interface CouponDetails {
  id: string;
  code: string;
  discountValue: number;
  discountType: CouponDiscountType;
  usageType: CouponUsageType;
  maxUsageCount: number;
  remainingUsageCount: number;
}
