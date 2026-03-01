from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


# --- ProductFeatures ---

class ProductFeaturesBase(BaseModel):
    web_gltf: bool = False
    web_usdz: bool = False
    web_360: bool = False
    app_ar: bool = False
    download3d: bool = False
    com: bool = False
    has_measurements: bool = False
    resolution_x: Optional[int] = None
    resolution_y: Optional[int] = None
    supported_formats: Optional[list] = None

class ProductFeaturesCreate(ProductFeaturesBase):
    pass

class ProductFeaturesOut(ProductFeaturesBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- RenderSettings ---

class RenderSettingsBase(BaseModel):
    rotate_size_x: Optional[int] = None
    rotate_size_y: Optional[int] = None
    tile_size_x: Optional[int] = None
    tile_size_y: Optional[int] = None
    zoom_size_x: Optional[int] = None
    zoom_size_y: Optional[int] = None
    shadow_enabled: bool = False

class RenderSettingsCreate(RenderSettingsBase):
    pass

class RenderSettingsOut(RenderSettingsBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- VariableGroup ---

class VariableGroupBase(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = None
    icon_selected: Optional[str] = None
    color: Optional[str] = None
    index: int = 0
    priority: int = 0
    description: Optional[str] = None

class VariableGroupCreate(VariableGroupBase):
    pass

class VariableGroupOut(VariableGroupBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- ChoiceGroup ---

class ChoiceGroupBase(BaseModel):
    name: str
    slug: Optional[str] = None
    index: int = 0

class ChoiceGroupCreate(ChoiceGroupBase):
    pass

class ChoiceGroupOut(ChoiceGroupBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- ProductPredicate ---

class ProductPredicateBase(BaseModel):
    predicate_key: str
    name: Optional[str] = None
    type: Optional[str] = None
    attribute: Optional[str] = None
    operator: Optional[str] = None
    compare_to: Optional[str] = None

class ProductPredicateCreate(ProductPredicateBase):
    pass

class ProductPredicateOut(ProductPredicateBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- ProductEvent ---

class ProductEventBase(BaseModel):
    trigger_variable: Optional[str] = None
    source_type: Optional[str] = "variable"
    source_variable: Optional[str] = None
    destinations: Optional[list] = None
    predicate_key: Optional[str] = None
    condition_attribute: Optional[str] = None
    condition_operator: Optional[str] = None
    condition_compare_to: Optional[str] = None

class ProductEventCreate(ProductEventBase):
    pass

class ProductEventOut(ProductEventBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- SectionalElement ---

class SectionalElementBase(BaseModel):
    element_id: Optional[int] = None
    name: Optional[str] = None
    display_name: Optional[str] = None
    file_id: Optional[str] = None
    default_variables: Optional[dict] = None
    includes: Optional[dict] = None
    positions: Optional[dict] = None

class SectionalElementCreate(SectionalElementBase):
    pass

class SectionalElementOut(SectionalElementBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- MenuSettings ---

class MenuSettingsBase(BaseModel):
    name: Optional[str] = None
    hidden_attributes: Optional[list] = None

class MenuSettingsCreate(MenuSettingsBase):
    pass

class MenuSettingsOut(MenuSettingsBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- AttributeMapping ---

class AttributeMappingBase(BaseModel):
    source_attribute: Optional[str] = None
    target_attributes: Optional[list] = None

class AttributeMappingCreate(AttributeMappingBase):
    pass

class AttributeMappingOut(AttributeMappingBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- DefaultConfiguration ---

class DefaultConfigurationBase(BaseModel):
    config_type: str
    elements: Optional[dict] = None

class DefaultConfigurationCreate(DefaultConfigurationBase):
    pass

class DefaultConfigurationOut(DefaultConfigurationBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- Intiaro Import Result ---

class IntiaroImportReport(BaseModel):
    product_id: int
    product_name: str
    sku: str
    configurations_count: int = 0
    options_count: int = 0
    variable_groups_count: int = 0
    choice_groups_count: int = 0
    predicates_count: int = 0
    events_count: int = 0
    sectional_elements_count: int = 0
    has_render_settings: bool = False
    has_product_features: bool = False
    has_menu_settings: bool = False
    attribute_mappings_count: int = 0
    default_configurations_count: int = 0
    errors: list[str] = []
