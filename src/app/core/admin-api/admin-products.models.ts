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

export interface SearchProductResponse {
  foundProducts: Product[];
  totalResults: number;
}

export interface Product {
  id: string;
  productName: string;
  productDescription: string;
  productSku: string;
  categories: ProductCategory[];
}

