from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import products,analytics,scraper

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Entrupy Price Monitor API",
    description="API for tracking competitor pricing across marketplaces.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REGISTER THE ROUTER
app.include_router(products.router)
app.include_router(analytics.router)
app.include_router(scraper.router, prefix="/scraper", tags=["Scraper"])

@app.on_event("startup")
def startup_populate_db():
    from .database import SessionLocal
    from .models import APIConsumer
    db = SessionLocal()
    # Check if our test key exists, if not, create it
    if not db.query(APIConsumer).filter(APIConsumer.api_key == "test_secret_key").first():
        new_consumer = APIConsumer(api_key="test_secret_key")
        db.add(new_consumer)
        db.commit()
    db.close()

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Entrupy Price Monitor API is running"}