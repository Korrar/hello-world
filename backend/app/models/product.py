import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime,
    ForeignKey, JSON, Table,
)
from sqlalchemy.orm import relationship
from app.database import Base


product_category = Table(
    "product_category",
    Base.metadata,
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE")),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE")),
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    parent = relationship("Category", remote_side=[id], backref="children")
    products = relationship("Product", secondary=product_category, back_populates="categories")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    manufacturer = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)
    product_kind = Column(String(20), default="product")  # product, sub_product, preset
    collection = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    base_price = Column(Float, default=0.0)
    currency = Column(String(10), default="USD")
    is_active = Column(Boolean, default=True)
    product_type = Column(String(100), nullable=True)

    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    depth = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    dimension_unit = Column(String(20), default="cm")
    weight_unit = Column(String(20), default="kg")

    thumbnail_url = Column(String(1000), nullable=True)
    model_3d_url = Column(String(1000), nullable=True)
    extra_data = Column(JSON, nullable=True)

    # Intiaro-specific columns
    intiaro_id = Column(Integer, nullable=True)
    intiaro_product_id = Column(Integer, nullable=True)
    product_system_version = Column(String(100), nullable=True)
    sectional_builder = Column(Boolean, default=False)

    model_intiaro_id = Column(Integer, nullable=True)
    parent_product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    categories = relationship("Category", secondary=product_category, back_populates="products")
    configurations = relationship("ProductConfiguration", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")

    # Intiaro relationships
    features = relationship("ProductFeatures", back_populates="product", uselist=False, cascade="all, delete-orphan")
    render_settings = relationship("RenderSettings", back_populates="product", uselist=False, cascade="all, delete-orphan")
    variable_groups = relationship("VariableGroup", back_populates="product", cascade="all, delete-orphan")
    choice_groups = relationship("ChoiceGroup", back_populates="product", cascade="all, delete-orphan")
    predicates = relationship("ProductPredicate", back_populates="product", cascade="all, delete-orphan")
    events = relationship("ProductEvent", back_populates="product", cascade="all, delete-orphan")
    sectional_elements = relationship("SectionalElement", back_populates="product", cascade="all, delete-orphan")
    menu_settings = relationship("MenuSettings", back_populates="product", uselist=False, cascade="all, delete-orphan")
    attribute_mappings = relationship("AttributeMapping", back_populates="product", cascade="all, delete-orphan")
    default_configurations = relationship("DefaultConfiguration", back_populates="product", cascade="all, delete-orphan")
    choice_overrides = relationship("ChoiceOverride", back_populates="product", cascade="all, delete-orphan")

    parent_product = relationship("Product", remote_side=[id], backref="sub_products", foreign_keys=[parent_product_id])


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(1000), nullable=False)
    alt_text = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="images")


class ProductConfiguration(Base):
    __tablename__ = "product_configurations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    config_type = Column(String(50), default="select")  # select, color, material, size, text
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    # Intiaro-specific columns
    slug = Column(String(255), nullable=True)
    group = Column(String(255), nullable=True)
    attribute_type = Column(String(100), nullable=True)
    variable_group = Column(String(255), nullable=True)
    visibility = Column(String(50), nullable=True)
    always_on = Column(Boolean, default=False)
    is_com = Column(Boolean, default=False)
    predicate = Column(String(255), nullable=True)
    display_text = Column(Text, nullable=True)
    dynamic_local_menu = Column(Boolean, default=False)
    application_methods = Column(JSON, nullable=True)
    available_choices_tags = Column(JSON, nullable=True)
    search = Column(JSON, nullable=True)
    filters = Column(JSON, nullable=True)
    sorting = Column(JSON, nullable=True)
    default_choice = Column(String(255), nullable=True)
    element_id = Column(Integer, nullable=True)  # null = global, value = local for element

    product = relationship("Product", back_populates="configurations")
    options = relationship("ConfigurationOption", back_populates="configuration", cascade="all, delete-orphan")


class ConfigurationOption(Base):
    __tablename__ = "configuration_options"

    id = Column(Integer, primary_key=True, index=True)
    configuration_id = Column(Integer, ForeignKey("product_configurations.id", ondelete="CASCADE"), nullable=False)
    value = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    price_modifier = Column(Float, default=0.0)
    price_modifier_type = Column(String(20), default="absolute")  # absolute, percentage
    sku_suffix = Column(String(50), nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    extra_data = Column(JSON, nullable=True)

    # Intiaro-specific columns
    slug = Column(String(255), nullable=True)
    choice_group = Column(String(255), nullable=True)
    tags = Column(JSON, nullable=True)
    icon = Column(String(1000), nullable=True)
    grade = Column(String(255), nullable=True)
    predicate = Column(String(255), nullable=True)
    texture_data = Column(JSON, nullable=True)
    choice_attributes = Column(JSON, nullable=True)
    element_id = Column(Integer, nullable=True)

    configuration = relationship("ProductConfiguration", back_populates="options")


class ChoiceOverride(Base):
    __tablename__ = "choice_overrides"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    option_id = Column(Integer, ForeignKey("configuration_options.id", ondelete="CASCADE"), nullable=False)
    element_id = Column(Integer, nullable=True)         # null = per product
    configuration_id = Column(Integer, ForeignKey("product_configurations.id", ondelete="CASCADE"), nullable=True)
    active = Column(Boolean, default=False, nullable=False)

    product = relationship("Product", back_populates="choice_overrides")
    option = relationship("ConfigurationOption")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(50), unique=True, nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_company = Column(String(255), nullable=True)
    status = Column(String(50), default="draft")  # draft, sent, accepted, rejected, expired
    notes = Column(Text, nullable=True)
    discount_percent = Column(Float, default=0.0)
    tax_percent = Column(Float, default=0.0)
    currency = Column(String(10), default="USD")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)

    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

    @property
    def subtotal(self):
        return sum(item.total_price for item in self.items)

    @property
    def discount_amount(self):
        return self.subtotal * (self.discount_percent / 100)

    @property
    def tax_amount(self):
        return (self.subtotal - self.discount_amount) * (self.tax_percent / 100)

    @property
    def total(self):
        return self.subtotal - self.discount_amount + self.tax_amount


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    selected_options = Column(JSON, nullable=True)  # {config_name: option_value, ...}
    notes = Column(Text, nullable=True)

    quote = relationship("Quote", back_populates="items")
    product = relationship("Product")

    @property
    def total_price(self):
        return self.unit_price * self.quantity
