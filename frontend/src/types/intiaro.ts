export interface ProductFeatures {
  id: number;
  product_id: number;
  web_gltf: boolean;
  web_usdz: boolean;
  web_360: boolean;
  app_ar: boolean;
  download3d: boolean;
  com: boolean;
  has_measurements: boolean;
  resolution_x?: number;
  resolution_y?: number;
  supported_formats?: string[];
}

export interface RenderSettings {
  id: number;
  product_id: number;
  rotate_size_x?: number;
  rotate_size_y?: number;
  tile_size_x?: number;
  tile_size_y?: number;
  zoom_size_x?: number;
  zoom_size_y?: number;
  shadow_enabled: boolean;
}

export interface VariableGroup {
  id: number;
  product_id: number;
  name: string;
  slug?: string;
  icon?: string;
  icon_selected?: string;
  color?: string;
  index: number;
  priority: number;
  description?: string;
}

export interface ChoiceGroup {
  id: number;
  product_id: number;
  name: string;
  slug?: string;
  index: number;
}

export interface ProductPredicate {
  id: number;
  product_id: number;
  predicate_key: string;
  name?: string;
  type?: string;
  attribute?: string;
  operator?: string;
  compare_to?: string;
}

export interface ProductEvent {
  id: number;
  product_id: number;
  trigger_variable?: string;
  source_type?: string;
  source_variable?: string;
  destinations?: string[];
  predicate_key?: string;
  condition_attribute?: string;
  condition_operator?: string;
  condition_compare_to?: string;
}

export interface SectionalElement {
  id: number;
  product_id: number;
  element_id?: number;
  name?: string;
  display_name?: string;
  file_id?: string;
  default_variables?: Record<string, unknown>;
  includes?: Record<string, unknown>;
  positions?: Record<string, unknown>;
}

export interface MenuSettings {
  id: number;
  product_id: number;
  name?: string;
  hidden_attributes?: string[];
}

export interface AttributeMapping {
  id: number;
  product_id: number;
  source_attribute?: string;
  target_attributes?: string[];
}

export interface DefaultConfiguration {
  id: number;
  product_id: number;
  config_type: string;
  elements?: Record<string, unknown>;
}

export interface IntiaroImportReport {
  product_id: number;
  product_name: string;
  sku: string;
  configurations_count: number;
  options_count: number;
  variable_groups_count: number;
  choice_groups_count: number;
  predicates_count: number;
  events_count: number;
  sectional_elements_count: number;
  has_render_settings: boolean;
  has_product_features: boolean;
  has_menu_settings: boolean;
  attribute_mappings_count: number;
  default_configurations_count: number;
  errors: string[];
}
