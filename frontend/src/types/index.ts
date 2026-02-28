export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
}

export interface ProductImage {
  id: number;
  product_id: number;
  url: string;
  alt_text?: string;
  sort_order: number;
}

export interface ConfigurationOption {
  id?: number;
  configuration_id?: number;
  value: string;
  display_name?: string;
  price_modifier: number;
  price_modifier_type: string;
  sku_suffix?: string;
  thumbnail_url?: string;
  is_default: boolean;
  sort_order: number;
  extra_data?: Record<string, unknown>;
}

export interface ProductConfiguration {
  id?: number;
  product_id?: number;
  name: string;
  display_name?: string;
  config_type: string;
  is_required: boolean;
  sort_order: number;
  options: ConfigurationOption[];
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  manufacturer?: string;
  collection?: string;
  description?: string;
  base_price: number;
  currency: string;
  is_active: boolean;
  product_type?: string;
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  dimension_unit: string;
  weight_unit: string;
  thumbnail_url?: string;
  model_3d_url?: string;
  extra_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  categories: Category[];
  configurations: ProductConfiguration[];
  images: ProductImage[];
}

export interface ProductListItem {
  id: number;
  sku: string;
  name: string;
  manufacturer?: string;
  collection?: string;
  base_price: number;
  currency: string;
  is_active: boolean;
  product_type?: string;
  thumbnail_url?: string;
  created_at: string;
}

export interface QuoteItem {
  id?: number;
  quote_id?: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  selected_options?: Record<string, string>;
  notes?: string;
}

export interface Quote {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_email?: string;
  customer_company?: string;
  status: string;
  notes?: string;
  discount_percent: number;
  tax_percent: number;
  currency: string;
  valid_until?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  created_at: string;
  updated_at: string;
  items: QuoteItem[];
}

export interface QuoteListItem {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_company?: string;
  status: string;
  subtotal: number;
  total: number;
  currency: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BulkImportResult {
  total_rows: number;
  imported: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}
