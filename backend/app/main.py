from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import products, quotes, imports, categories

Base.metadata.create_all(bind=engine)

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
