from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# --- Category ---

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int
    model_config = {"from_attributes": True}


# --- Product Image ---

class ProductImageBase(BaseModel):
    url: str
    alt_text: Optional[str] = None
    sort_order: int = 0

class ProductImageCreate(ProductImageBase):
    pass

class ProductImageOut(ProductImageBase):
    id: int
    product_id: int
    model_config = {"from_attributes": True}


# --- Configuration Option ---

class ConfigurationOptionBase(BaseModel):
    value: str
    display_name: Optional[str] = None
    price_modifier: float = 0.0
    price_modifier_type: str = "absolute"
    sku_suffix: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_default: bool = False
    sort_order: int = 0
    extra_data: Optional[dict] = None

class ConfigurationOptionCreate(ConfigurationOptionBase):
    pass

class ConfigurationOptionOut(ConfigurationOptionBase):
    id: int
    configuration_id: int
    model_config = {"from_attributes": True}


# --- Product Configuration ---

class ProductConfigurationBase(BaseModel):
    name: str
    display_name: Optional[str] = None
    config_type: str = "select"
    is_required: bool = False
    sort_order: int = 0

class ProductConfigurationCreate(ProductConfigurationBase):
    options: list[ConfigurationOptionCreate] = []

class ProductConfigurationOut(ProductConfigurationBase):
    id: int
    product_id: int
    options: list[ConfigurationOptionOut] = []
    model_config = {"from_attributes": True}


# --- Product ---

class ProductBase(BaseModel):
    sku: str
    name: str
    manufacturer: Optional[str] = None
    collection: Optional[str] = None
    description: Optional[str] = None
    base_price: float = 0.0
    currency: str = "USD"
    is_active: bool = True
    product_type: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    weight: Optional[float] = None
    dimension_unit: str = "cm"
    weight_unit: str = "kg"
    thumbnail_url: Optional[str] = None
    model_3d_url: Optional[str] = None
    extra_data: Optional[dict] = None

class ProductCreate(ProductBase):
    category_ids: list[int] = []
    configurations: list[ProductConfigurationCreate] = []
    images: list[ProductImageCreate] = []

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    collection: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    product_type: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    weight: Optional[float] = None
    dimension_unit: Optional[str] = None
    weight_unit: Optional[str] = None
    thumbnail_url: Optional[str] = None
    model_3d_url: Optional[str] = None
    extra_data: Optional[dict] = None
    category_ids: Optional[list[int]] = None

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    categories: list[CategoryOut] = []
    configurations: list[ProductConfigurationOut] = []
    images: list[ProductImageOut] = []
    model_config = {"from_attributes": True}

class ProductListOut(BaseModel):
    id: int
    sku: str
    name: str
    manufacturer: Optional[str] = None
    collection: Optional[str] = None
    base_price: float
    currency: str
    is_active: bool
    product_type: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Quote ---

class QuoteItemBase(BaseModel):
    product_id: int
    quantity: int = 1
    unit_price: float
    selected_options: Optional[dict] = None
    notes: Optional[str] = None

class QuoteItemCreate(QuoteItemBase):
    pass

class QuoteItemOut(QuoteItemBase):
    id: int
    quote_id: int
    model_config = {"from_attributes": True}

class QuoteBase(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_company: Optional[str] = None
    status: str = "draft"
    notes: Optional[str] = None
    discount_percent: float = 0.0
    tax_percent: float = 0.0
    currency: str = "USD"
    valid_until: Optional[datetime] = None

class QuoteCreate(QuoteBase):
    items: list[QuoteItemCreate] = []

class QuoteUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_company: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    discount_percent: Optional[float] = None
    tax_percent: Optional[float] = None
    currency: Optional[str] = None
    valid_until: Optional[datetime] = None

class QuoteOut(QuoteBase):
    id: int
    quote_number: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total: float
    created_at: datetime
    updated_at: datetime
    items: list[QuoteItemOut] = []
    model_config = {"from_attributes": True}

class QuoteListOut(BaseModel):
    id: int
    quote_number: str
    customer_name: str
    customer_company: Optional[str] = None
    status: str
    subtotal: float
    total: float
    currency: str
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Bulk Import ---

class BulkImportResult(BaseModel):
    total_rows: int
    imported: int
    updated: int
    errors: list[dict]

class BulkProductRow(BaseModel):
    sku: str
    name: str
    manufacturer: Optional[str] = None
    collection: Optional[str] = None
    description: Optional[str] = None
    base_price: float = 0.0
    currency: str = "USD"
    product_type: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    weight: Optional[float] = None
    dimension_unit: str = "cm"
    weight_unit: str = "kg"
    thumbnail_url: Optional[str] = None
    categories: Optional[str] = None  # comma-separated
    extra_data: Optional[dict] = None


# --- Pagination ---

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
