export type OrderStatus =
  | 'PENDING'
  | 'EMAIL_VERIFIED'
  | 'WAITING_FOR_CUSTOMER_RECONFIRMATION'
  | 'CUSTOMER_RECONFIRMED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'EXPIRED';

export type CouponType = 'PERCENTAGE' | 'FIXED';

export interface AdminOrderUserDetails {
  fullName: string | null;
  email: string | null;
  address: string | null;
  phoneNumber: string | null;
  municipality: string | null;
  postalCode: string | null;
}

export interface AdminOrderItem {
  sizeAttributeVariantId: string;
  sizeVariantAttributeValue: string;
  productName: string;
  productSku: string;
  quantity: number;
  pricePerUnit: number;
  totalItemPrice: number;
}

export interface AdminOrder {
  orderId: string;
  status: OrderStatus;
  totalPrice: number;
  description: string;
  couponCode: string | null;
  couponValue: number | null;
  couponType: CouponType | null;
  userDetails: AdminOrderUserDetails | null;
  orderDate?: string | null;
  items: AdminOrderItem[];
  itemsChanged?: boolean | null;
}

export interface UnregisteredOrderRequest {
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
  orderItems: Array<{
    sizeVariantAttributeId: string;
    quantity: number;
  }>;
}

export type UnregisteredOrderResponse = unknown;

export interface OrdersByEmailRequest {
  email: string;
}
