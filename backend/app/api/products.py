import math

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models.product import (
    Product, Category, ProductConfiguration, ConfigurationOption, ProductImage,
    ChoiceOverride,
)
from app.models.intiaro import (
    ProductFeatures, RenderSettings, VariableGroup, ChoiceGroup,
    ProductPredicate, ProductEvent, SectionalElement, MenuSettings,
    AttributeMapping, DefaultConfiguration,
)
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductOut, ProductListOut,
    ProductConfigurationCreate, ProductConfigurationOut,
    ConfigurationOptionCreate, ConfigurationOptionOut,
    CategoryCreate, CategoryOut,
    ProductImageCreate, ProductImageOut,
    ChoiceOverrideCreate, ChoiceOverrideOut,
    SubProductCreate,
    PresetCreate,
)
from app.schemas.intiaro import (
    SectionalElementCreate, SectionalElementOut,
    ProductPredicateCreate, ProductPredicateOut,
    ProductEventCreate, ProductEventOut,
    DefaultConfigurationCreate, DefaultConfigurationOut,
)

router = APIRouter(prefix="/api/products", tags=["products"])


# --- Products ---

@router.get("", response_model=dict)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str = Query("", description="Search by name or SKU"),
    manufacturer: str = Query("", description="Filter by manufacturer"),
    product_type: str = Query("", description="Filter by product type"),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.parent_product_id.is_(None))

    if search:
        query = query.filter(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )
    if manufacturer:
        query = query.filter(Product.manufacturer == manufacturer)
    if product_type:
        query = query.filter(Product.product_type == product_type)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    total = query.count()
    products = (
        query.order_by(Product.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    sub_counts: dict[int, int] = {}
    if products:
        parent_ids = [p.id for p in products]
        rows = db.query(Product.parent_product_id, func.count(Product.id)).filter(
            Product.parent_product_id.in_(parent_ids)
        ).group_by(Product.parent_product_id).all()
        sub_counts = {r[0]: r[1] for r in rows}

    items = []
    for p in products:
        out = ProductListOut.model_validate(p)
        out.sub_products_count = sub_counts.get(p.id, 0)
        items.append(out)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    brand = data.brand or data.manufacturer or ''
    existing = db.query(Product).filter(Product.sku == data.sku, Product.brand == brand).first()
    if existing:
        raise HTTPException(400, f"Product with SKU '{data.sku}' already exists for brand '{brand}'")

    product_data = data.model_dump(exclude={"category_ids", "configurations", "images"})
    product_data['brand'] = brand
    product = Product(**product_data)

    if data.category_ids:
        categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
        product.categories = categories

    db.add(product)
    db.flush()

    for cfg in data.configurations:
        cfg_data = cfg.model_dump(exclude={"options"})
        config = ProductConfiguration(product_id=product.id, **cfg_data)
        db.add(config)
        db.flush()
        for opt in cfg.options:
            option = ConfigurationOption(configuration_id=config.id, **opt.model_dump())
            db.add(option)

    for img in data.images:
        image = ProductImage(product_id=product.id, **img.model_dump())
        db.add(image)

    db.commit()
    db.refresh(product)
    return product


_product_eager_options = [
    selectinload(Product.categories),
    selectinload(Product.configurations).selectinload(ProductConfiguration.options),
    selectinload(Product.images),
    joinedload(Product.features),
    joinedload(Product.render_settings),
    selectinload(Product.variable_groups),
    selectinload(Product.choice_groups),
    selectinload(Product.predicates),
    selectinload(Product.events),
    selectinload(Product.sectional_elements),
    joinedload(Product.menu_settings),
    selectinload(Product.attribute_mappings),
    selectinload(Product.default_configurations),
    selectinload(Product.choice_overrides),
]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(*_product_eager_options)
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")

    # Inheritance chain
    if product.product_kind == "sub_product" and product.parent_product_id:
        # Sub-product: inherit configs/elements/predicates from root product (parent)
        root = (
            db.query(Product)
            .options(*_product_eager_options)
            .filter(Product.id == product.parent_product_id)
            .first()
        )
        if root:
            product.configurations = root.configurations
            product.sectional_elements = root.sectional_elements
            product.predicates = root.predicates
            product.variable_groups = root.variable_groups
            product.choice_groups = root.choice_groups
            product.events = root.events
            product.features = root.features
            product.render_settings = root.render_settings
            product.menu_settings = root.menu_settings
            product.attribute_mappings = root.attribute_mappings
    elif product.product_kind == "preset" and product.parent_product_id:
        # Preset: inherit choice_overrides from sub-product (parent),
        # configs/elements/predicates from root product (grandparent)
        sub_parent = (
            db.query(Product)
            .options(*_product_eager_options)
            .filter(Product.id == product.parent_product_id)
            .first()
        )
        if sub_parent:
            product.choice_overrides = sub_parent.choice_overrides
            root_id = sub_parent.parent_product_id
            if root_id:
                root = (
                    db.query(Product)
                    .options(*_product_eager_options)
                    .filter(Product.id == root_id)
                    .first()
                )
                if root:
                    product.configurations = root.configurations
                    product.sectional_elements = root.sectional_elements
                    product.predicates = root.predicates
                    product.variable_groups = root.variable_groups
                    product.choice_groups = root.choice_groups
                    product.events = root.events
                    product.features = root.features
                    product.render_settings = root.render_settings
                    product.menu_settings = root.menu_settings
                    product.attribute_mappings = root.attribute_mappings

    # Count direct children (sub-products for product, presets for sub-product)
    sub_count = db.query(func.count(Product.id)).filter(Product.parent_product_id == product_id).scalar() or 0

    out = ProductOut.model_validate(product)
    out.sub_products_count = sub_count
    return out


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    update_data = data.model_dump(exclude_unset=True)
    category_ids = update_data.pop("category_ids", None)

    for k, v in update_data.items():
        setattr(product, k, v)

    if category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(category_ids)).all()
        product.categories = categories

    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/delete-info")
def get_delete_info(product_id: int, db: Session = Depends(get_db)):
    """Return hierarchy counts for delete confirmation dialog."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    sub_ids = [r[0] for r in db.query(Product.id).filter(
        Product.parent_product_id == product_id
    ).all()]
    presets_count = 0
    if sub_ids:
        presets_count = db.query(func.count(Product.id)).filter(
            Product.parent_product_id.in_(sub_ids)
        ).scalar() or 0
    return {
        "sub_products_count": len(sub_ids),
        "presets_count": presets_count,
    }


def _collect_descendant_ids(db: Session, product_id: int) -> list[int]:
    """Collect all descendant product IDs (sub-products + their presets)."""
    sub_ids = [r[0] for r in db.query(Product.id).filter(
        Product.parent_product_id == product_id
    ).all()]
    preset_ids = []
    if sub_ids:
        preset_ids = [r[0] for r in db.query(Product.id).filter(
            Product.parent_product_id.in_(sub_ids)
        ).all()]
    return sub_ids + preset_ids


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    # Delete all descendants first (presets, then sub-products)
    descendant_ids = _collect_descendant_ids(db, product_id)
    if descendant_ids:
        db.query(Product).filter(Product.id.in_(descendant_ids)).delete(synchronize_session=False)
    db.delete(product)
    db.commit()


@router.delete("", status_code=204)
def delete_products(ids: list[int] = Query(...), db: Session = Depends(get_db)):
    # Collect all descendants for all products being deleted
    all_ids = set(ids)
    for pid in ids:
        all_ids.update(_collect_descendant_ids(db, pid))
    db.query(Product).filter(Product.id.in_(all_ids)).delete(synchronize_session=False)
    db.commit()


# --- Sub-products ---

@router.get("/{product_id}/sub-products", response_model=list[ProductListOut])
def list_sub_products(product_id: int, db: Session = Depends(get_db)):
    subs = db.query(Product).filter(
        Product.parent_product_id == product_id,
        Product.product_kind == "sub_product",
    ).order_by(Product.name).all()
    # Count presets per sub-product
    preset_counts: dict[int, int] = {}
    if subs:
        sub_ids = [s.id for s in subs]
        rows = db.query(Product.parent_product_id, func.count(Product.id)).filter(
            Product.parent_product_id.in_(sub_ids),
            Product.product_kind == "preset",
        ).group_by(Product.parent_product_id).all()
        preset_counts = {r[0]: r[1] for r in rows}
    items = []
    for s in subs:
        out = ProductListOut.model_validate(s)
        out.sub_products_count = preset_counts.get(s.id, 0)
        items.append(out)
    return items


@router.post("/{product_id}/sub-products", response_model=ProductOut, status_code=201)
def create_sub_product(product_id: int, data: SubProductCreate, db: Session = Depends(get_db)):
    parent = db.query(Product).filter(Product.id == product_id).first()
    if not parent:
        raise HTTPException(404, "Parent product not found")
    if parent.product_kind != "product":
        raise HTTPException(400, "Sub-products can only be created under a root product")
    brand = data.brand or parent.brand or parent.manufacturer or ''
    existing = db.query(Product).filter(Product.sku == data.sku, Product.brand == brand).first()
    if existing:
        raise HTTPException(400, f"Product with SKU '{data.sku}' already exists for brand '{brand}'")
    sub = Product(
        sku=data.sku,
        name=data.name,
        manufacturer=data.manufacturer or parent.manufacturer,
        brand=brand,
        product_kind="sub_product",
        parent_product_id=product_id,
        model_intiaro_id=parent.model_intiaro_id,
        base_price=parent.base_price,
        currency=parent.currency,
        product_type=parent.product_type,
        product_system_version=parent.product_system_version,
        sectional_builder=parent.sectional_builder,
        intiaro_id=parent.intiaro_id,
        intiaro_product_id=parent.intiaro_product_id,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return get_product(sub.id, db)


# --- Presets (children of sub-products) ---

@router.get("/{sub_product_id}/presets", response_model=list[ProductListOut])
def list_presets(sub_product_id: int, db: Session = Depends(get_db)):
    presets = db.query(Product).filter(
        Product.parent_product_id == sub_product_id,
        Product.product_kind == "preset",
    ).order_by(Product.name).all()
    return [ProductListOut.model_validate(p) for p in presets]


@router.post("/{sub_product_id}/presets", response_model=ProductOut, status_code=201)
def create_preset(sub_product_id: int, data: PresetCreate, db: Session = Depends(get_db)):
    sub = db.query(Product).filter(Product.id == sub_product_id).first()
    if not sub:
        raise HTTPException(404, "Sub-product not found")
    if sub.product_kind != "sub_product":
        raise HTTPException(400, "Presets can only be created under a sub-product")
    brand = sub.brand or ''
    existing = db.query(Product).filter(Product.sku == data.sku, Product.brand == brand).first()
    if existing:
        raise HTTPException(400, f"Product with SKU '{data.sku}' already exists for brand '{brand}'")
    preset = Product(
        sku=data.sku,
        name=data.name,
        manufacturer=sub.manufacturer,
        brand=brand,
        product_kind="preset",
        parent_product_id=sub_product_id,
        model_intiaro_id=sub.model_intiaro_id,
        base_price=sub.base_price,
        currency=sub.currency,
        product_type=sub.product_type,
        product_system_version=sub.product_system_version,
        sectional_builder=sub.sectional_builder,
        intiaro_id=sub.intiaro_id,
        intiaro_product_id=sub.intiaro_product_id,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return get_product(preset.id, db)


# --- Auto-rebuild default configuration ---

def _rebuild_default_configuration(db: Session, product_id: int):
    """Build default_configuration from current configs' default choices and save it."""
    configs = (
        db.query(ProductConfiguration)
        .options(selectinload(ProductConfiguration.options))
        .filter(ProductConfiguration.product_id == product_id)
        .all()
    )
    if not configs:
        return
    variables: dict[str, str] = {}
    for cfg in configs:
        slug = cfg.slug or cfg.name
        if not slug:
            continue
        default_value = cfg.default_choice
        if not default_value:
            default_opt = next((o for o in cfg.options if o.is_default), None)
            if default_opt:
                default_value = default_opt.slug or default_opt.value
        if not default_value and cfg.options:
            default_value = cfg.options[0].slug or cfg.options[0].value
        if default_value:
            variables[slug] = default_value
    if not variables:
        return
    elements_dict = {"configuration": {"variables": variables}}
    existing = (
        db.query(DefaultConfiguration)
        .filter(DefaultConfiguration.product_id == product_id, DefaultConfiguration.config_type == "default")
        .first()
    )
    if existing:
        existing.elements = elements_dict
    else:
        dc = DefaultConfiguration(product_id=product_id, config_type="default", elements=elements_dict)
        db.add(dc)


# --- Configurations ---

@router.post("/{product_id}/configurations", response_model=ProductConfigurationOut, status_code=201)
def add_configuration(
    product_id: int, data: ProductConfigurationCreate, db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    cfg_data = data.model_dump(exclude={"options"})
    config = ProductConfiguration(product_id=product_id, **cfg_data)
    db.add(config)
    db.flush()

    for opt in data.options:
        option = ConfigurationOption(configuration_id=config.id, **opt.model_dump())
        db.add(option)

    _rebuild_default_configuration(db, product_id)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{product_id}/configurations/{config_id}", status_code=204)
def delete_configuration(product_id: int, config_id: int, db: Session = Depends(get_db)):
    config = (
        db.query(ProductConfiguration)
        .filter(ProductConfiguration.id == config_id, ProductConfiguration.product_id == product_id)
        .first()
    )
    if not config:
        raise HTTPException(404, "Configuration not found")
    db.delete(config)
    _rebuild_default_configuration(db, product_id)
    db.commit()


# --- Sectional Elements ---

@router.get("/{product_id}/elements", response_model=list[SectionalElementOut])
def list_elements(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return db.query(SectionalElement).filter(SectionalElement.product_id == product_id).all()


@router.post("/{product_id}/elements", response_model=SectionalElementOut, status_code=201)
def add_element(product_id: int, data: SectionalElementCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    element = SectionalElement(product_id=product_id, **data.model_dump())
    db.add(element)
    if not product.sectional_builder:
        product.sectional_builder = True
    db.commit()
    db.refresh(element)
    return element


@router.put("/{product_id}/elements/{element_db_id}", response_model=SectionalElementOut)
def update_element(product_id: int, element_db_id: int, data: SectionalElementCreate, db: Session = Depends(get_db)):
    element = (
        db.query(SectionalElement)
        .filter(SectionalElement.id == element_db_id, SectionalElement.product_id == product_id)
        .first()
    )
    if not element:
        raise HTTPException(404, "Element not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(element, k, v)
    db.commit()
    db.refresh(element)
    return element


@router.delete("/{product_id}/elements/{element_db_id}", status_code=204)
def delete_element(product_id: int, element_db_id: int, db: Session = Depends(get_db)):
    element = (
        db.query(SectionalElement)
        .filter(SectionalElement.id == element_db_id, SectionalElement.product_id == product_id)
        .first()
    )
    if not element:
        raise HTTPException(404, "Element not found")
    db.delete(element)
    remaining = db.query(SectionalElement).filter(SectionalElement.product_id == product_id).count()
    if remaining == 0:
        product = db.query(Product).filter(Product.id == product_id).first()
        if product:
            product.sectional_builder = False
    db.commit()


# --- Predicates ---

@router.post("/{product_id}/predicates", response_model=ProductPredicateOut, status_code=201)
def add_predicate(product_id: int, data: ProductPredicateCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    existing = db.query(ProductPredicate).filter(
        ProductPredicate.product_id == product_id,
        ProductPredicate.predicate_key == data.predicate_key,
    ).first()
    if existing:
        raise HTTPException(400, f"Predicate key '{data.predicate_key}' already exists")
    predicate = ProductPredicate(product_id=product_id, **data.model_dump())
    db.add(predicate)
    db.commit()
    db.refresh(predicate)
    return predicate


@router.put("/{product_id}/predicates/{predicate_id}", response_model=ProductPredicateOut)
def update_predicate(product_id: int, predicate_id: int, data: ProductPredicateCreate, db: Session = Depends(get_db)):
    predicate = (
        db.query(ProductPredicate)
        .filter(ProductPredicate.id == predicate_id, ProductPredicate.product_id == product_id)
        .first()
    )
    if not predicate:
        raise HTTPException(404, "Predicate not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(predicate, k, v)
    db.commit()
    db.refresh(predicate)
    return predicate


@router.delete("/{product_id}/predicates/{predicate_id}", status_code=204)
def delete_predicate(product_id: int, predicate_id: int, db: Session = Depends(get_db)):
    predicate = (
        db.query(ProductPredicate)
        .filter(ProductPredicate.id == predicate_id, ProductPredicate.product_id == product_id)
        .first()
    )
    if not predicate:
        raise HTTPException(404, "Predicate not found")
    # Clear predicate references from configurations and options
    db.query(ProductConfiguration).filter(
        ProductConfiguration.product_id == product_id,
        ProductConfiguration.predicate == predicate.predicate_key,
    ).update({"predicate": None}, synchronize_session=False)
    db.query(ConfigurationOption).filter(
        ConfigurationOption.configuration_id.in_(
            db.query(ProductConfiguration.id).filter(ProductConfiguration.product_id == product_id)
        ),
        ConfigurationOption.predicate == predicate.predicate_key,
    ).update({"predicate": None}, synchronize_session=False)
    db.delete(predicate)
    db.commit()


# --- Predicate assignment ---

class PredicateAssignBody(BaseModel):
    predicate: str | None = None


@router.patch("/{product_id}/configurations/{config_id}/predicate", status_code=200)
def set_config_predicate(
    product_id: int, config_id: int, data: PredicateAssignBody, db: Session = Depends(get_db)
):
    config = (
        db.query(ProductConfiguration)
        .filter(ProductConfiguration.id == config_id, ProductConfiguration.product_id == product_id)
        .first()
    )
    if not config:
        raise HTTPException(404, "Configuration not found")
    config.predicate = data.predicate
    db.commit()
    return {"ok": True}


@router.patch("/{product_id}/options/{option_id}/predicate", status_code=200)
def set_option_predicate(
    product_id: int, option_id: int, data: PredicateAssignBody, db: Session = Depends(get_db)
):
    option = (
        db.query(ConfigurationOption)
        .join(ProductConfiguration)
        .filter(ConfigurationOption.id == option_id, ProductConfiguration.product_id == product_id)
        .first()
    )
    if not option:
        raise HTTPException(404, "Option not found")
    option.predicate = data.predicate
    db.commit()
    return {"ok": True}


# --- Events ---

@router.post("/{product_id}/events", response_model=ProductEventOut, status_code=201)
def add_event(product_id: int, data: ProductEventCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    event = ProductEvent(product_id=product_id, **data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{product_id}/events/{event_id}", response_model=ProductEventOut)
def update_event(product_id: int, event_id: int, data: ProductEventCreate, db: Session = Depends(get_db)):
    event = (
        db.query(ProductEvent)
        .filter(ProductEvent.id == event_id, ProductEvent.product_id == product_id)
        .first()
    )
    if not event:
        raise HTTPException(404, "Event not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{product_id}/events/{event_id}", status_code=204)
def delete_event(product_id: int, event_id: int, db: Session = Depends(get_db)):
    event = (
        db.query(ProductEvent)
        .filter(ProductEvent.id == event_id, ProductEvent.product_id == product_id)
        .first()
    )
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()


# --- Default Configurations ---

@router.put("/{product_id}/default-configurations/{config_type}", response_model=DefaultConfigurationOut)
def save_default_configuration(product_id: int, config_type: str, data: DefaultConfigurationCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    existing = (
        db.query(DefaultConfiguration)
        .filter(DefaultConfiguration.product_id == product_id, DefaultConfiguration.config_type == config_type)
        .first()
    )
    if existing:
        existing.elements = data.elements
        db.commit()
        db.refresh(existing)
        return existing
    dc = DefaultConfiguration(product_id=product_id, config_type=config_type, elements=data.elements)
    db.add(dc)
    db.commit()
    db.refresh(dc)
    return dc


@router.delete("/{product_id}/default-configurations/{config_type}", status_code=204)
def delete_default_configuration(product_id: int, config_type: str, db: Session = Depends(get_db)):
    existing = (
        db.query(DefaultConfiguration)
        .filter(DefaultConfiguration.product_id == product_id, DefaultConfiguration.config_type == config_type)
        .first()
    )
    if not existing:
        raise HTTPException(404, "Default configuration not found")
    db.delete(existing)
    db.commit()


# --- Choice Overrides ---


def _choice_in_default_config(elements: dict, choice_slug: str) -> bool:
    """Check if a choice slug is used as a variable value in a default configuration."""
    if not elements or not isinstance(elements, dict):
        return False

    def check_vars(variables):
        return isinstance(variables, dict) and choice_slug in variables.values()

    # {variables: {key: slug}}
    if check_vars(elements.get("variables")):
        return True

    # {configuration: {variables: ...}} or {configuration: {elements: [...]}}
    config = elements.get("configuration")
    if isinstance(config, dict):
        if check_vars(config.get("variables")):
            return True
        el_list = config.get("elements")
        if isinstance(el_list, list):
            for el in el_list:
                if isinstance(el, dict) and check_vars(el.get("variables")):
                    return True
        elif isinstance(el_list, dict):
            for el_data in el_list.values():
                if isinstance(el_data, dict) and check_vars(el_data.get("variables")):
                    return True

    # {elements: {key: {variables: ...}}} or {elements: [{variables: ...}]}
    els = elements.get("elements")
    if isinstance(els, dict):
        for el_data in els.values():
            if isinstance(el_data, dict) and check_vars(el_data.get("variables")):
                return True
    elif isinstance(els, list):
        for el in els:
            if isinstance(el, dict) and check_vars(el.get("variables")):
                return True

    return False


def _check_choice_in_hierarchy_defaults(db: Session, product_id: int, choice_slug: str) -> list[str]:
    """Return list of product names where choice_slug is used in default_configuration.
    Checks: product itself + sub-products + presets (sub-products' children)."""
    # Gather all product IDs in hierarchy
    all_ids = [product_id]
    sub_ids = [r[0] for r in db.query(Product.id).filter(Product.parent_product_id == product_id).all()]
    all_ids.extend(sub_ids)
    if sub_ids:
        preset_ids = [r[0] for r in db.query(Product.id).filter(Product.parent_product_id.in_(sub_ids)).all()]
        all_ids.extend(preset_ids)

    # Single query for all default configs in hierarchy
    dcs = (
        db.query(DefaultConfiguration.product_id, DefaultConfiguration.elements)
        .filter(DefaultConfiguration.product_id.in_(all_ids))
        .all()
    )

    # Check each DC
    conflict_product_ids = set()
    for dc_product_id, dc_elements in dcs:
        if _choice_in_default_config(dc_elements, choice_slug):
            conflict_product_ids.add(dc_product_id)

    if not conflict_product_ids:
        return []

    # Fetch names for conflicting products
    products = (
        db.query(Product.id, Product.name, Product.sku, Product.product_kind)
        .filter(Product.id.in_(list(conflict_product_ids)))
        .all()
    )
    return [
        f"{p.name} ({p.sku}) [{p.product_kind or 'product'}]"
        for p in products
    ]


@router.post("/{product_id}/choice-overrides", response_model=ChoiceOverrideOut, status_code=201)
def create_choice_override(product_id: int, data: ChoiceOverrideCreate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    # When disabling a choice, validate it's not in any default configuration in the hierarchy
    if not data.active:
        option = db.query(ConfigurationOption).filter(ConfigurationOption.id == data.option_id).first()
        if option:
            choice_slug = option.slug or option.value
            # Find the root product to check the full hierarchy
            root_id = product_id
            if product.parent_product_id:
                parent = db.query(Product).filter(Product.id == product.parent_product_id).first()
                if parent and parent.parent_product_id:
                    root_id = parent.parent_product_id  # preset → sub → root
                else:
                    root_id = product.parent_product_id  # sub → root
            conflicts = _check_choice_in_hierarchy_defaults(db, root_id, choice_slug)
            if conflicts:
                names = "; ".join(conflicts)
                raise HTTPException(
                    400,
                    f"Nie można wyłączyć choice \"{choice_slug}\" — jest używany w default configuration: {names}. "
                    f"Najpierw zmień default configuration tych produktów."
                )

    # Upsert: check for existing override with same option_id + element_id + configuration_id
    existing = (
        db.query(ChoiceOverride)
        .filter(
            ChoiceOverride.product_id == product_id,
            ChoiceOverride.option_id == data.option_id,
            ChoiceOverride.element_id == data.element_id if data.element_id is not None else ChoiceOverride.element_id.is_(None),
            ChoiceOverride.configuration_id == data.configuration_id if data.configuration_id is not None else ChoiceOverride.configuration_id.is_(None),
        )
        .first()
    )
    if existing:
        existing.active = data.active
        db.commit()
        db.refresh(existing)
        return existing
    override = ChoiceOverride(product_id=product_id, **data.model_dump())
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


@router.put("/{product_id}/choice-overrides/{override_id}", response_model=ChoiceOverrideOut)
def update_choice_override(product_id: int, override_id: int, data: ChoiceOverrideCreate, db: Session = Depends(get_db)):
    override = (
        db.query(ChoiceOverride)
        .filter(ChoiceOverride.id == override_id, ChoiceOverride.product_id == product_id)
        .first()
    )
    if not override:
        raise HTTPException(404, "Choice override not found")
    for k, v in data.model_dump().items():
        setattr(override, k, v)
    db.commit()
    db.refresh(override)
    return override


@router.delete("/{product_id}/choice-overrides/{override_id}", status_code=204)
def delete_choice_override(product_id: int, override_id: int, db: Session = Depends(get_db)):
    override = (
        db.query(ChoiceOverride)
        .filter(ChoiceOverride.id == override_id, ChoiceOverride.product_id == product_id)
        .first()
    )
    if not override:
        raise HTTPException(404, "Choice override not found")
    db.delete(override)
    db.commit()


# --- Filters metadata ---

@router.get("/meta/filters", response_model=dict)
def get_filters(db: Session = Depends(get_db)):
    manufacturers = [
        r[0] for r in db.query(Product.manufacturer).distinct().filter(Product.manufacturer.isnot(None)).all()
    ]
    product_types = [
        r[0] for r in db.query(Product.product_type).distinct().filter(Product.product_type.isnot(None)).all()
    ]
    return {"manufacturers": sorted(manufacturers), "product_types": sorted(product_types)}
