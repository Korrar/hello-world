import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models.product import (
    Product, Category, ProductConfiguration, ConfigurationOption, ProductImage,
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
)
from app.schemas.intiaro import SectionalElementCreate, SectionalElementOut

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
    query = db.query(Product)

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

    return {
        "items": [ProductListOut.model_validate(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.sku == data.sku).first()
    if existing:
        raise HTTPException(400, f"Product with SKU '{data.sku}' already exists")

    product_data = data.model_dump(exclude={"category_ids", "configurations", "images"})
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


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(
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
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")
    return product


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


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    db.delete(product)
    db.commit()


@router.delete("", status_code=204)
def delete_products(ids: list[int] = Query(...), db: Session = Depends(get_db)):
    db.query(Product).filter(Product.id.in_(ids)).delete(synchronize_session=False)
    db.commit()


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
