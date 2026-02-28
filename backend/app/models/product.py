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
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    manufacturer = Column(String(255), nullable=True)
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

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    categories = relationship("Category", secondary=product_category, back_populates="products")
    configurations = relationship("ProductConfiguration", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")


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

    configuration = relationship("ProductConfiguration", back_populates="options")


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
