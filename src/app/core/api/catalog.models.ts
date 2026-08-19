import type { ProductVariantPriority } from '../../shared/data/product-variant-priority';

export interface ApiCategory {
  id: string;
  name: string;
}

export interface ApiCategoryValue {
  id: string;
  value: string;
  displayValue?: string;
  parent?: { id?: string; value?: string; displayValue?: string } | null;
  hasChildren?: boolean;
}

export interface ProductsSearchRequest {
  searchQuery?: string;
  initialCategoryFilters?: Record<string, string[]>;
  initialSpecialFilters?: string[];
  categoryFilters?: Record<string, string[]>;
  attributeFilters?: Record<string, string[]>;
  minPrice?: number | null;
  maxPrice?: number | null;
  isNew?: boolean | null;
  isOutlet?: boolean | null;
  hasActiveDiscount?: boolean | null;
  hasActiveStock?: boolean | null;
  page?: number;
  pageSize?: number;
  sortBy?: 'PRIORITY' | 'NAME' | 'PRICE';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ProductSearchResponse {
  variants: Variant[];
  availableCategories: AvailableCategory[];
  availableAttributes: AvailableAttribute[];
  priceRange?: { filterName: string; minPrice: number; maxPrice: number } | null;
  newProducts?: SpecialFilterBlock | null;
  outletProducts?: SpecialFilterBlock | null;
  discountedProducts?: SpecialFilterBlock | null;
  availableProducts?: SpecialFilterBlock | null;
  totalResults: number;
}

export interface SpecialFilterBlock {
  alreadySelected: boolean;
  name: string;
  count: number;
}

export interface Variant {
  id: string;
  productId?: string;
  productName: string;
  name?: string;
  productDescription?: string;
  description?: string;
  shortDescription?: string;
  subtitle?: string;
  productSku?: string;
  sku?: string;
  displaySku?: string;
  variantSku?: string;
  originalPrice?: number;
  price?: number;
  finalPrice?: number;
  currency?: string;
  discountPrice?: number;
  quantity?: number;
  mainImageName?: string;
  mainImageUrl?: string;
  mainImageWebUrl?: string;
  mainImageThumbnailUrl?: string;
  categories?: Array<{
    id?: string;
    categoryId: string;
    categoryName: string;
    categoryValueId: string;
    value?: string;
    displayValue?: string;
    description?: string;
  }>;
  attributes?: Array<{
    id?: string;
    attributeId: string;
    attributeName: string;
    attributeDisplayValue?: string;
    attributeValueId: string;
    quantity?: number;
    value?: string;
    displayValue?: string;
  }>;
  images?: Array<{
    id: string;
    url?: string;
    originalUrl?: string;
    webUrl?: string;
    thumbnailUrl?: string;
    displayed: boolean;
  }>;
  relatedProducts?: RelatedProductVariant[];
  brand?: string;
  outlet?: boolean;
  new?: boolean;
  displayRank?: ProductVariantPriority;
}

export interface RelatedProductVariant {
  id: string;
  variantId?: string;
  productId?: string;
  productName?: string;
  name?: string;
  sku?: string;
  displaySku?: string;
  originalPrice?: number;
  price?: number;
  finalPrice?: number;
  currency?: string;
  quantity?: number;
  mainImageName?: string;
  mainImageUrl?: string;
  mainImageWebUrl?: string;
  mainImageThumbnailUrl?: string;
}

export interface AvailableCategory {
  id: string;
  name: string;
  values: Array<{
    id: string;
    value?: string;
    displayValue?: string;
    count: number;
    alreadySelected: boolean;
  }>;
}

export interface AvailableAttribute {
  id: string;
  name: string;
  values: Array<{
    id: string;
    value?: string;
    displayValue?: string;
    count: number;
    alreadySelected: boolean;
  }>;
}
