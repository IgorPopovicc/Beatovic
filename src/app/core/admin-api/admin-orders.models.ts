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
  orderNumber: string;
  pantheonOrderId?: number | null;
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

export interface OrdersByEmailRequest {
  email: string;
}
