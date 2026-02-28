import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.product import BulkImportResult, BulkProductRow
from app.schemas.intiaro import IntiaroImportReport
from app.services.import_service import import_products, parse_csv, parse_json
from app.services.intiaro_import import import_intiaro_product

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/file", response_model=BulkImportResult)
async def import_from_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = (await file.read()).decode("utf-8")
    filename = file.filename or ""

    if filename.endswith(".csv"):
        rows = parse_csv(content)
    elif filename.endswith(".json"):
        rows = parse_json(content)
    else:
        raise HTTPException(400, "Unsupported file format. Use .csv or .json")

    result = import_products(db, rows)
    return result


@router.post("/json", response_model=BulkImportResult)
def import_from_json(rows: list[BulkProductRow], db: Session = Depends(get_db)):
    data = [r.model_dump() for r in rows]
    result = import_products(db, data)
    return result


@router.post("/api-fetch", response_model=BulkImportResult)
async def import_from_api(
    url: str,
    db: Session = Depends(get_db),
):
    """Import products from an external API URL (e.g., Intiaro PIM API).
    Expects the URL to return JSON with product data."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch from API: {str(e)}")

    if isinstance(data, dict):
        if "results" in data:
            rows = data["results"]
        else:
            rows = [data]
    else:
        rows = data

    # Map Intiaro PIM fields to our schema
    mapped_rows = []
    for item in rows:
        mapped = {
            "sku": str(item.get("id", item.get("sku", ""))),
            "name": item.get("name", item.get("product_name", "")),
            "manufacturer": item.get("manufacturer", item.get("brand", "")),
            "collection": item.get("collection", ""),
            "description": item.get("description", ""),
            "product_type": item.get("product_type", item.get("type", "")),
            "base_price": item.get("price", item.get("base_price", 0)),
            "thumbnail_url": item.get("thumbnail", item.get("thumbnail_url", "")),
            "extra_data": {
                k: v for k, v in item.items()
                if k not in ("id", "name", "manufacturer", "brand", "collection",
                             "description", "product_type", "type", "price",
                             "base_price", "thumbnail", "thumbnail_url", "sku")
            },
        }

        # Handle dimensions
        dimensions = item.get("dimensions", {})
        if dimensions:
            mapped["width"] = dimensions.get("width")
            mapped["height"] = dimensions.get("height")
            mapped["depth"] = dimensions.get("depth")

        # Handle configurations
        configs = item.get("configurations", item.get("options", []))
        if configs and isinstance(configs, list):
            mapped["configurations"] = []
            for cfg in configs:
                if isinstance(cfg, dict):
                    cfg_mapped = {
                        "name": cfg.get("name", cfg.get("attribute_name", "")),
                        "display_name": cfg.get("display_name", cfg.get("label", "")),
                        "config_type": cfg.get("type", "select"),
                        "options": [],
                    }
                    for opt in cfg.get("values", cfg.get("options", [])):
                        if isinstance(opt, dict):
                            cfg_mapped["options"].append({
                                "value": str(opt.get("value", opt.get("id", ""))),
                                "display_name": opt.get("display_name", opt.get("label", "")),
                                "price_modifier": opt.get("price_modifier", 0),
                                "thumbnail_url": opt.get("thumbnail", ""),
                            })
                        else:
                            cfg_mapped["options"].append({"value": str(opt)})
                    mapped["configurations"].append(cfg_mapped)

        mapped_rows.append(mapped)

    result = import_products(db, mapped_rows)
    return result


@router.post("/intiaro", response_model=IntiaroImportReport)
async def import_from_intiaro(
    url: str,
    db: Session = Depends(get_db),
):
    """Import a product from Intiaro PIM API with full data mapping.
    Uses dedicated models for each Intiaro data element (render_settings,
    predicates, events, sectional elements, etc.) instead of storing
    everything in extra_data."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(400, f"API returned error {e.response.status_code}: {str(e)}")
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch from Intiaro API: {str(e)}")

    if not isinstance(data, dict):
        raise HTTPException(400, "Expected a single product instance object from Intiaro API")

    report = import_intiaro_product(db, data)

    if report["errors"]:
        raise HTTPException(400, detail=report)

    return report
