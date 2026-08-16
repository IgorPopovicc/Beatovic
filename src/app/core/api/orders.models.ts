import type { AdminOrder } from '../admin-api/admin-orders.models';

export interface CreateOrderItemDTO {
  sizeVariantAttributeId: string;
  quantity: number;
}

export interface CreateOrderQuoteDTO {
  orderItems: CreateOrderItemDTO[];
  couponCode?: string;
  email?: string;
}

export type OrderQuoteCouponType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface OrderQuoteDTO {
  subtotal?: number;
  discountAmount?: number;
  totalPrice?: number;
  couponCode?: string | null;
  couponType?: OrderQuoteCouponType | null;
  couponValue?: number | null;
}

export interface CreateUnregisteredOrderDTO {
  description?: string;
  couponCode?: string;
  userDetails: {
    email: string;
    fullName: string;
    phoneNumber: string;
    address: string;
    municipality: string;
    postalCode: string;
    privacyPolicyAccepted: boolean;
  };
  orderItems: CreateOrderItemDTO[];
}

export type CreateUnregisteredOrderResponse = AdminOrder;
