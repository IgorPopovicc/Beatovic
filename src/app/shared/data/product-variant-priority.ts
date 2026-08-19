export type ProductVariantPriority = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export const PRODUCT_VARIANT_PRIORITIES: readonly ProductVariantPriority[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
];

export function isProductVariantPriority(value: unknown): value is ProductVariantPriority {
  return PRODUCT_VARIANT_PRIORITIES.includes(value as ProductVariantPriority);
}
