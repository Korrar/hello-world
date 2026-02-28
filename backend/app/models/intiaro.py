from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, JSON, ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base


class ProductFeatures(Base):
    __tablename__ = "product_features"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)
    web_gltf = Column(Boolean, default=False)
    web_usdz = Column(Boolean, default=False)
    web_360 = Column(Boolean, default=False)
    app_ar = Column(Boolean, default=False)
    download3d = Column(Boolean, default=False)
    com = Column(Boolean, default=False)
    has_measurements = Column(Boolean, default=False)
    resolution_x = Column(Integer, nullable=True)
    resolution_y = Column(Integer, nullable=True)
    supported_formats = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="features")


class RenderSettings(Base):
    __tablename__ = "render_settings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)
    rotate_size_x = Column(Integer, nullable=True)
    rotate_size_y = Column(Integer, nullable=True)
    tile_size_x = Column(Integer, nullable=True)
    tile_size_y = Column(Integer, nullable=True)
    zoom_size_x = Column(Integer, nullable=True)
    zoom_size_y = Column(Integer, nullable=True)
    shadow_enabled = Column(Boolean, default=False)

    product = relationship("Product", back_populates="render_settings")


class VariableGroup(Base):
    __tablename__ = "variable_groups"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True)
    icon = Column(String(1000), nullable=True)
    icon_selected = Column(String(1000), nullable=True)
    color = Column(String(20), nullable=True)
    index = Column(Integer, default=0)
    priority = Column(Integer, default=0)
    description = Column(Text, nullable=True)

    product = relationship("Product", back_populates="variable_groups")


class ChoiceGroup(Base):
    __tablename__ = "choice_groups"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=True)
    index = Column(Integer, default=0)

    product = relationship("Product", back_populates="choice_groups")


class ProductPredicate(Base):
    __tablename__ = "product_predicates"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    predicate_key = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    type = Column(String(50), nullable=True)
    attribute = Column(String(255), nullable=True)
    operator = Column(String(50), nullable=True)
    compare_to = Column(String(500), nullable=True)

    product = relationship("Product", back_populates="predicates")


class ProductEvent(Base):
    __tablename__ = "product_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(100), nullable=True)
    source_variable = Column(String(255), nullable=True)
    destinations = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="events")


class SectionalElement(Base):
    __tablename__ = "sectional_elements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    element_id = Column(Integer, nullable=True)
    name = Column(String(255), nullable=True)
    file_id = Column(String(255), nullable=True)
    default_variables = Column(JSON, nullable=True)
    includes = Column(JSON, nullable=True)
    positions = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="sectional_elements")


class MenuSettings(Base):
    __tablename__ = "menu_settings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)
    name = Column(String(255), nullable=True)
    hidden_attributes = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="menu_settings")


class AttributeMapping(Base):
    __tablename__ = "attribute_mappings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    source_attribute = Column(String(255), nullable=True)
    target_attributes = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="attribute_mappings")


class DefaultConfiguration(Base):
    __tablename__ = "default_configurations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    config_type = Column(String(50), nullable=False)  # "default" / "entry_default"
    elements = Column(JSON, nullable=True)

    product = relationship("Product", back_populates="default_configurations")
