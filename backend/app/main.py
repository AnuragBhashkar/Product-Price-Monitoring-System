from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import products, analytics, scraper


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once on startup before the server begins accepting requests.
    Seeds the default API consumer so the system works out-of-the-box.
    """
    models.Base.metadata.create_all(bind=engine)

    from .database import SessionLocal
    from .models import APIConsumer
    db = SessionLocal()
    try:
        if not db.query(APIConsumer).filter(APIConsumer.api_key == "test_secret_key").first():
            db.add(APIConsumer(api_key="test_secret_key"))
            db.commit()
    finally:
        db.close()

    yield  # Server is running — hand control back to FastAPI


app = FastAPI(
    title="Entrupy Price Monitor API",
    description="API for tracking competitor pricing across marketplaces.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(analytics.router)
app.include_router(scraper.router, prefix="/scraper", tags=["Scraper"])


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Entrupy Price Monitor API is running"}