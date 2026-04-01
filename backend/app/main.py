from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import products,analytics 

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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Entrupy Price Monitor API is running"}