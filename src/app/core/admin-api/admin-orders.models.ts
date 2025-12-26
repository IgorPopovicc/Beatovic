export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELED';

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

