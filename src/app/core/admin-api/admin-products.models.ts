import type { ProductVariantPriority } from '../../shared/data/product-variant-priority';
import type { AvailableAttribute, AvailableCategory, Variant } from '../api/catalog.models';

export interface SearchMainRequest {
  searchQuery: string;
  page?: number;
  pageSize?: number;
}

export interface SearchMainResponse {
  foundVariants: ProductVariant[];
  foundCategories: FoundCategory[];
  foundAttributes: FoundAttribute[];
  totalResults: number;
}

export interface ProductVariant {
  id: string;
  productId?: string;
  productName: string;
  productDescription?: string;
  productSku?: string;
  categories?: ProductCategory[];
  sku?: string;
  displaySku?: string;
  originalPrice?: number;
  finalPrice?: number;
  discountPrice?: number;
  quantity?: number;
  attributes?: ProductAttribute[];
  activeDiscounts?: VariantDiscountDetails[];
  images?: ProductImage[];
  relatedProducts?: RelatedProduct[];
  mainImageName?: string;
  mainImageUrl?: string;
  mainImageWebUrl?: string;
  mainImageThumbnailUrl?: string;
  outlet?: boolean;
  new?: boolean;
  displayRank?: ProductVariantPriority;
}

export interface ProductCategory {
  id?: string;
  categoryId: string;
  categoryName: string;
  categoryValueId: string;
  value: string;
  displayValue?: string;
  description?: string;
}

export interface ProductAttribute {
  id: string;
  attributeId: string;
  attributeName: string;
  attributeDisplayValue?: string;
  attributeValueId: string;
  value?: string;
  displayValue?: string;
  quantity?: number;
}

export interface VariantDiscountDetails {
  id: string;
  variantId?: string;
  discountId?: string;
  discountDescription?: string;
  value: number;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
}

export interface ProductImage {
  id: string;
  url?: string;
  originalUrl?: string;
  webUrl?: string;
  thumbnailUrl?: string;
  displayed: boolean;
}

export interface RelatedProduct {
  id: string;
  mainImageName?: string;
  mainImageUrl?: string;
  mainImageWebUrl?: string;
  mainImageThumbnailUrl?: string;
}

export interface FoundCategory {
  id: string;
  name: string;
  values: Array<{
    id: string;
    value?: string;
    displayValue?: string;
    count?: number;
    alreadySelected?: boolean;
  }>;
}

export interface FoundAttribute {
  id?: string;
  name?: string;
  values?: Array<{
    id: string;
    value?: string;
    displayValue?: string;
    count?: number;
    alreadySelected?: boolean;
  }>;
}

export interface CreateProductRequest {
  productName: string;
  productDescription: string;
  sku: string;
  categories: Array<{
    categoryId: string;
    categoryValueId: string;
  }>;
}

export interface SearchProductRequest {
  searchQuery: string;
  page?: number;
  pageSize?: number;
}

export interface Product {
  id: string;
  productName: string;
  productDescription: string;
  productSku: string;
  categories: ProductCategory[];
  variants?: Array<{
    id: string;
    sku?: string;
    displaySku?: string;
    colorVariantAttributeValue?: string;
    mainImageName?: string;
    mainImageWebUrl?: string;
    mainImageThumbnailUrl?: string;
  }>;
}

export interface ProductIdSkuPair {
  id: string;
  sku: string;
}

export interface ProductVariantIdSkuPair {
  id: string;
  sku: string;
  displaySku?: string;
}

export interface UpdateProductRequest {
  id: string;
  productName: string;
  productDescription: string;
  categoriesToAdd?: Array<{
    categoryId: string;
    categoryValueId: string;
  }>;
  productCategoryIdsToRemove?: string[];
}

export interface AttributeDTO {
  id: string;
  name: string;
  displayValue?: string;
}

export interface AttributeValueDTO {
  id: string;
  value: string;
  displayValue?: string;
  parent?: { id?: string; value?: string; displayValue?: string } | null;
}

export interface CreateProductVariantAttributeDTO {
  id?: string;
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
  value: string;
  quantity: number;
}

export interface CreateProductVariantDTO {
  productId: string;
  sku?: string;
  price: number;
  isNew?: boolean;
  isOutlet?: boolean;
  priority?: ProductVariantPriority;
  attributes: CreateProductVariantAttributeDTO[];
  discountIds?: string[];
  displayImageName?: string;
}

export interface UpdateProductVariantDTO {
  id: string;
  price: number;
  isNew?: boolean;
  isOutlet?: boolean;
  priority?: ProductVariantPriority;
  attributesToAdd?: ProductAttribute[];
  attributeVariantIdsToRemove?: string[];
  discountIdsToAdd?: string[];
  discountVariantIdsToRemove?: string[];
  imageIdsToRemove?: string[];
  displayImageName?: string;
}

export interface DiscountDTO {
  id: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  startDate: string;
  endDate: string;
  description: string;
}

export interface AdminVariantPrioritySearchRequest {
  searchQuery?: string;
  categoryFilters?: Record<string, string[]>;
  priorities?: ProductVariantPriority[];
  page: number;
  pageSize: number;
  sortBy: 'PRIORITY' | 'NAME' | 'PRICE';
  sortOrder: 'ASC' | 'DESC';
}

export interface AdminVariantPrioritySearchResponse {
  variants: Variant[];
  availableCategories: AvailableCategory[];
  availableAttributes: AvailableAttribute[];
  totalResults: number;
}

export interface BulkVariantPriorityItem {
  sku: string;
  priority: ProductVariantPriority;
}

export interface BulkUpdateVariantPriorityRequest {
  items: BulkVariantPriorityItem[];
}

export interface BulkVariantPriorityResult {
  updatedCount: number;
  notFoundCount: number;
  notFoundSkus: string[];
}
