export interface ApiCategory {
  id: string;
  name: string;
}

export interface ApiCategoryValue {
  id: string;
  value: string;
}

export interface ProductsSearchRequest {
  initialCategoryFilters?: Record<string, string[]>;
}

export interface ProductSearchResponse {
  variants: Variant[];
  availableCategories: AvailableCategory[];
  availableAttributes: AvailableAttribute[];
  priceRange?: { filterName: string; minPrice: number; maxPrice: number };
  newProducts?: { alreadySelected: boolean; name: string; count: number } | null;
  outletProducts?: any;
  discountedProducts?: any;
  totalResults: number;
}

export interface Variant {
  id: string;
  productId: string;
  productName: string;
  productDescription: string;
  productSku: string;
  sku: string;

  originalPrice: number;
  finalPrice: number;
  discountPrice: number;
  quantity: number;

  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryValueId: string;
    value: string;
  }>;

  attributes: Array<{
    attributeId: string;
    attributeName: string;
    attributeValueId: string;
    quantity: number;
    value: string;
  }>;

  images: Array<{ id: string; url: string; displayed: boolean }>;
  relatedProducts: Array<{ id: string; mainImageUrl: string }>;
  outlet: boolean;
  new: boolean;
}

export interface AvailableCategory {
  id: string;
  name: string;
  values: Array<{ id: string; value: string; count: number; alreadySelected: boolean }>;
}

export interface AvailableAttribute {
  id: string;
  name: string;
  values: Array<{ id: string; value: string; count: number; alreadySelected: boolean }>;
}
