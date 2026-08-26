import type { AdminOrder } from '../admin-api/admin-orders.models';

export interface CreateOrderItemDTO {
  sizeVariantAttributeId: string;
  quantity: number;
}

export type CartAvailabilityReason =
  | 'AVAILABLE'
  | 'INVALID_QUANTITY'
  | 'NOT_FOUND'
  | 'SIZE_INACTIVE'
  | 'VARIANT_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_QUANTITY';

export interface CartAvailabilityRequestDTO {
  items: CreateOrderItemDTO[];
}

export interface CartItemAvailabilityDTO {
  sizeVariantAttributeId: string;
  variantId?: string | null;
  requestedQuantity: number;
  availableQuantity: number;
  available: boolean;
  reason: CartAvailabilityReason;
}

export interface CartAvailabilityResponseDTO {
  valid: boolean;
  items: CartItemAvailabilityDTO[];
}

export interface ApiErrorDTO {
  code?: string;
  message?: string;
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
