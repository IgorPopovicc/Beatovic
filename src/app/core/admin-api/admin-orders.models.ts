export type OrderStatus = 'PENDING' | 'EMAIL_VERIFIED' | 'COMPLETED' | 'CANCELED' | 'EXPIRED';

export type CouponType = 'PERCENTAGE' | 'FIXED';

export interface AdminOrderUserDetails {
  fullName: string;
  email: string;
  address: string;
  phoneNumber: string;
  municipality: string;
  postalCode: string;
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
  userDetails: AdminOrderUserDetails;
  items: AdminOrderItem[];
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
