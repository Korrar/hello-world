from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import products, quotes, imports, categories
import app.models.intiaro  # noqa: F401 — ensure Intiaro tables are registered

Base.metadata.create_all(bind=engine)

# Migration: add element_id column to product_configurations if missing
from sqlalchemy import inspect as sa_inspect, text
inspector = sa_inspect(engine)
columns = [c['name'] for c in inspector.get_columns('product_configurations')]
if 'element_id' not in columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE product_configurations ADD COLUMN element_id INTEGER"))
        conn.commit()

el_columns = [c['name'] for c in inspector.get_columns('sectional_elements')]
if 'display_name' not in el_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE sectional_elements ADD COLUMN display_name VARCHAR(255)"))
        conn.commit()

prod_columns = [c['name'] for c in inspector.get_columns('products')]
if 'model_intiaro_id' not in prod_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN model_intiaro_id INTEGER"))
        conn.commit()
if 'parent_product_id' not in prod_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN parent_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL"))
        conn.commit()
if 'brand' not in prod_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN brand VARCHAR(255)"))
        conn.commit()
if 'product_kind' not in prod_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN product_kind VARCHAR(20) DEFAULT 'product'"))
        conn.commit()
# Drop unique constraint on sku (SQLite: recreate index without unique)
try:
    with engine.connect() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ix_products_sku"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku)"))
        conn.commit()
except Exception:
    pass

# Migration: add new event columns
ev_columns = [c['name'] for c in inspector.get_columns('product_events')]
for col_name, col_def in [
    ('trigger_variable', 'VARCHAR(255)'),
    ('source_type', "VARCHAR(50) DEFAULT 'variable'"),
    ('predicate_key', 'VARCHAR(255)'),
    ('condition_attribute', 'VARCHAR(255)'),
    ('condition_operator', 'VARCHAR(50)'),
    ('condition_compare_to', 'VARCHAR(255)'),
]:
    if col_name not in ev_columns:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE product_events ADD COLUMN {col_name} {col_def}"))
            conn.commit()
# Drop old event_type column data (keep column for compat but not used)

app = FastAPI(title="CPQ - Configure Price Quote", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(quotes.router)
app.include_router(imports.router)
app.include_router(categories.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
