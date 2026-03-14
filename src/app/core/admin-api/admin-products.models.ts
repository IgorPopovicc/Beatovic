export interface SearchMainRequest {
  searchQuery: string;
}

export interface SearchMainResponse {
  foundVariants: ProductVariant[];
  foundCategories: FoundCategory[];
  foundAttributes: FoundAttribute[];
  totalResults: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  productName: string;
  productDescription: string;
  productSku: string;
  categories: ProductCategory[];
  sku: string;
  originalPrice: number;
  finalPrice: number;
  discountPrice: number;
  quantity: number;
  attributes: ProductAttribute[];
  activeDiscounts: unknown[];
  images: ProductImage[];
  relatedProducts: RelatedProduct[];
  outlet: boolean;
  new: boolean;
}

export interface ProductCategory {
  categoryId: string;
  categoryName: string;
  categoryValueId: string;
  value: string;
}

export interface ProductAttribute {
  id: string;
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
  value: string;
  quantity: number;
}

export interface ProductImage {
  id: string;
  url: string;
  displayed: boolean;
}

export interface RelatedProduct {
  id: string;
  mainImageUrl: string;
}

export interface FoundCategory {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

export interface FoundAttribute {
  id?: string;
  name?: string;
  values?: Array<{ id: string; value: string }>;
}

export interface CreateProductRequest {
  productName: string;
  productDescription: string;
  sku: string;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryValueId: string;
    value: string;
  }>;
}

export interface SearchProductRequest {
  searchQuery: string;
}

export interface Product {
  id: string;
  productName: string;
  productDescription: string;
  productSku: string;
  categories: ProductCategory[];
}

export interface UpdateProductRequest {
  id: string;
  productName: string;
  productDescription: string;
  productSku: string;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryValueId: string;
    value: string;
  }>;
}

/**
 * ===========================
 * DODATO ZA "DODAJ MODEL"
 * (ne mijenja postojeće tipove)
 * ===========================
 */

export interface AttributeDTO {
  id: string;
  name: string;
}

export interface AttributeValueDTO {
  id: string;
  value: string;
}

/**
 * DTO koji šalješ backendu za atribut u varijanti
 * (namjerno je isto kao ProductAttribute shape, ali ime je jasnije za create)
 */
export interface CreateProductVariantAttributeDTO {
  id: string;
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
  value: string;
  quantity: number;
}

/**
 * DTO za kreiranje varijante (modela)
 * Pokriva: productId, sku, price, isNew, isOutlet, attributes, discountIds?, displayImageName?
 */
export interface CreateProductVariantDTO {
  productId: string;
  sku: string;
  price: number;
  isNew: boolean;
  isOutlet: boolean;
  attributes: CreateProductVariantAttributeDTO[];
  discountIds?: string[];
  displayImageName?: string;
}

export interface UpdateProductVariantDTO {
  id: string;
  price: number;
  attributes: ProductAttribute[];
  isNew?: boolean;
  isOutlet?: boolean;
  discountIds?: string[];
  imageIdsToRemove?: string[];
  displayImageName?: string;
}

export interface DiscountDTO {
  id: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  description: string;
}
