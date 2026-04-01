from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Product, PriceHistory
from ..schemas import ProductResponse
from ..dependencies import verify_api_key
from ..services.scraper import run_all_scrapers

# All endpoints in this router will require the verify_api_key dependency
router = APIRouter(
    prefix="/products",
    tags=["Products"],
    dependencies=[Depends(verify_api_key)]
)

@router.post("/refresh")
async def trigger_data_refresh(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Triggers the async scraper to run in the background."""
    # We use BackgroundTasks so the API responds immediately while scraping happens
    background_tasks.add_task(run_all_scrapers, db)
    return {"message": "Data refresh triggered successfully. Scraping in background."}

@router.get("/", response_model=List[ProductResponse])
def get_products(
    source: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    db: Session = Depends(get_db)
):
    """Browse and filter products by source, category, and price range."""
    query = db.query(Product)

    if source:
        query = query.filter(Product.source_marketplace.ilike(f"%{source}%"))
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    if min_price is not None:
        query = query.filter(Product.current_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.current_price <= max_price)

    # Limit to 100 for performance
    return query.limit(100).all()

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """View a single product's details and its price history."""
    product = db.query(Product).filter(Product.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return product