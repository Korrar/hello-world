import type {
  ProductFeatures, RenderSettings, VariableGroup, ChoiceGroup,
  ProductPredicate, ProductEvent, SectionalElement, MenuSettings,
  AttributeMapping, DefaultConfiguration,
} from './intiaro';

export type {
  ProductFeatures, RenderSettings, VariableGroup, ChoiceGroup,
  ProductPredicate, ProductEvent, SectionalElement, MenuSettings,
  AttributeMapping, DefaultConfiguration,
} from './intiaro';

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
  // Intiaro fields
  slug?: string;
  choice_group?: string;
  tags?: string[];
  icon?: string;
  grade?: string;
  predicate?: string;
  texture_data?: Record<string, unknown>;
  choice_attributes?: Record<string, unknown>;
  element_id?: number;
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
  // Intiaro fields
  slug?: string;
  group?: string;
  attribute_type?: string;
  variable_group?: string;
  visibility?: string;
  always_on?: boolean;
  is_com?: boolean;
  predicate?: string;
  display_text?: string;
  dynamic_local_menu?: boolean;
  application_methods?: unknown[];
  available_choices_tags?: unknown[];
  search?: Record<string, unknown> | unknown[];
  filters?: Record<string, unknown> | unknown[];
  sorting?: Record<string, unknown> | unknown[];
  default_choice?: string;
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
  // Intiaro fields
  intiaro_id?: number;
  intiaro_product_id?: number;
  product_system_version?: string;
  sectional_builder?: boolean;
  created_at: string;
  updated_at: string;
  categories: Category[];
  configurations: ProductConfiguration[];
  images: ProductImage[];
  // Intiaro relations
  features?: ProductFeatures;
  render_settings?: RenderSettings;
  variable_groups: VariableGroup[];
  choice_groups: ChoiceGroup[];
  predicates: ProductPredicate[];
  events: ProductEvent[];
  sectional_elements: SectionalElement[];
  menu_settings?: MenuSettings;
  attribute_mappings: AttributeMapping[];
  default_configurations: DefaultConfiguration[];
}

export interface ConfiguratorElementOutput {
  element_id: number;
  variables: Record<string, string>;
}

export interface ConfiguratorOutput {
  configuration: {
    elements?: ConfiguratorElementOutput[];
    variables?: Record<string, string>;
  };
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
