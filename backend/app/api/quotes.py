import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.product import Quote, QuoteItem, Product
from app.schemas.product import (
    QuoteCreate, QuoteUpdate, QuoteOut, QuoteListOut, QuoteItemCreate, QuoteItemOut,
)

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def _generate_quote_number() -> str:
    now = datetime.utcnow()
    short_id = uuid.uuid4().hex[:6].upper()
    return f"Q-{now.strftime('%Y%m%d')}-{short_id}"


@router.get("", response_model=dict)
def list_quotes(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: str = Query(""),
    search: str = Query(""),
    db: Session = Depends(get_db),
):
    query = db.query(Quote)

    if status:
        query = query.filter(Quote.status == status)
    if search:
        query = query.filter(
            (Quote.customer_name.ilike(f"%{search}%"))
            | (Quote.quote_number.ilike(f"%{search}%"))
            | (Quote.customer_company.ilike(f"%{search}%"))
        )

    total = query.count()
    quotes = (
        query.options(joinedload(Quote.items))
        .order_by(Quote.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [QuoteListOut.model_validate(q) for q in quotes],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


@router.post("", response_model=QuoteOut, status_code=201)
def create_quote(data: QuoteCreate, db: Session = Depends(get_db)):
    quote_data = data.model_dump(exclude={"items"})
    quote = Quote(quote_number=_generate_quote_number(), **quote_data)
    db.add(quote)
    db.flush()

    for item_data in data.items:
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(400, f"Product ID {item_data.product_id} not found")
        item = QuoteItem(quote_id=quote.id, **item_data.model_dump())
        db.add(item)

    db.commit()
    db.refresh(quote)
    return quote


@router.get("/{quote_id}", response_model=QuoteOut)
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = (
        db.query(Quote)
        .options(joinedload(Quote.items))
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(404, "Quote not found")
    return quote


@router.put("/{quote_id}", response_model=QuoteOut)
def update_quote(quote_id: int, data: QuoteUpdate, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(quote, k, v)

    db.commit()
    db.refresh(quote)
    return quote


@router.delete("/{quote_id}", status_code=204)
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    db.delete(quote)
    db.commit()


# --- Quote Items ---

@router.post("/{quote_id}/items", response_model=QuoteItemOut, status_code=201)
def add_quote_item(quote_id: int, data: QuoteItemCreate, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(400, f"Product ID {data.product_id} not found")

    item = QuoteItem(quote_id=quote_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{quote_id}/items/{item_id}", response_model=QuoteItemOut)
def update_quote_item(
    quote_id: int, item_id: int, data: QuoteItemCreate, db: Session = Depends(get_db)
):
    item = (
        db.query(QuoteItem)
        .filter(QuoteItem.id == item_id, QuoteItem.quote_id == quote_id)
        .first()
    )
    if not item:
        raise HTTPException(404, "Quote item not found")

    for k, v in data.model_dump().items():
        setattr(item, k, v)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{quote_id}/items/{item_id}", status_code=204)
def delete_quote_item(quote_id: int, item_id: int, db: Session = Depends(get_db)):
    item = (
        db.query(QuoteItem)
        .filter(QuoteItem.id == item_id, QuoteItem.quote_id == quote_id)
        .first()
    )
    if not item:
        raise HTTPException(404, "Quote item not found")
    db.delete(item)
    db.commit()
