import csv
import io
import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.product import Product, Category, ProductConfiguration, ConfigurationOption


def parse_csv(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content))
    return [dict(row) for row in reader]


def parse_json(content: str) -> list[dict[str, Any]]:
    data = json.loads(content)
    if isinstance(data, dict):
        # Handle single object or {results: [...]} format
        if "results" in data:
            return data["results"]
        return [data]
    return data


def _get_or_create_category(db: Session, name: str) -> Category:
    name = name.strip()
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name)
        db.add(cat)
        db.flush()
    return cat


def _import_configurations(db: Session, product: Product, configs: list[dict]):
    for cfg_data in configs:
        options_data = cfg_data.pop("options", [])
        config = ProductConfiguration(product_id=product.id, **cfg_data)
        db.add(config)
        db.flush()
        for opt_data in options_data:
            option = ConfigurationOption(configuration_id=config.id, **opt_data)
            db.add(option)


def import_products(db: Session, rows: list[dict[str, Any]]) -> dict:
    result = {"total_rows": len(rows), "imported": 0, "updated": 0, "errors": []}

    for idx, row in enumerate(rows):
        try:
            categories_str = row.pop("categories", None)
            configurations = row.pop("configurations", None)
            images = row.pop("images", None)

            # Clean up empty strings and convert types
            cleaned = {}
            for k, v in row.items():
                if v == "" or v is None:
                    continue
                if k in ("base_price", "width", "height", "depth", "weight"):
                    try:
                        cleaned[k] = float(v)
                    except (ValueError, TypeError):
                        cleaned[k] = None
                else:
                    cleaned[k] = v

            sku = cleaned.get("sku")
            if not sku:
                result["errors"].append({"row": idx + 1, "error": "Missing SKU"})
                continue

            if "name" not in cleaned or not cleaned["name"]:
                result["errors"].append({"row": idx + 1, "error": "Missing name"})
                continue

            existing = db.query(Product).filter(Product.sku == sku).first()
            if existing:
                for k, v in cleaned.items():
                    if k != "sku" and v is not None:
                        setattr(existing, k, v)
                product = existing
                result["updated"] += 1
            else:
                product = Product(**cleaned)
                db.add(product)
                db.flush()
                result["imported"] += 1

            # Handle categories
            if categories_str:
                cat_names = [c.strip() for c in str(categories_str).split(",") if c.strip()]
                product.categories = [_get_or_create_category(db, name) for name in cat_names]

            # Handle configurations (JSON import)
            if configurations and isinstance(configurations, list):
                # Remove existing configs for clean import
                for old_cfg in product.configurations:
                    db.delete(old_cfg)
                db.flush()
                _import_configurations(db, product, configurations)

        except Exception as e:
            result["errors"].append({"row": idx + 1, "error": str(e)})

    db.commit()
    return result
