export interface ApiCategory {
  id: string;
  name: string;
}

export interface ApiCategoryValue {
  id: string;
  value: string;
  displayValue?: string;
  parent?: { id?: string; value?: string; displayValue?: string } | null;
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
  sortBy?: 'NAME' | 'PRICE';
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
  productDescription?: string;
  productSku?: string;
  sku?: string;
  originalPrice?: number;
  finalPrice?: number;
  discountPrice?: number;
  quantity?: number;
  mainImageName?: string;
  mainImageUrl?: string;
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
  images?: Array<{ id: string; url: string; displayed: boolean }>;
  relatedProducts?: Array<{ id: string; mainImageUrl?: string }>;
  outlet?: boolean;
  new?: boolean;
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
