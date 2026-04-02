from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Product, PriceHistory
from ..auth import verify_api_key
from .. import schemas

router = APIRouter(
    prefix="/products",
    tags=["Products"],
    dependencies=[Depends(verify_api_key)]
)

@router.get("/", response_model=List[schemas.ProductOut])
def get_products(
    db: Session = Depends(get_db),
    source: Optional[str] = Query(None, description="Filter by marketplace source"),
    category: Optional[str] = Query(None, description="Filter by category"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    search: Optional[str] = Query(None, description="Search by product name")
):
    query = db.query(Product)

    if source:
        query = query.filter(Product.source_marketplace.ilike(f"%{source}%"))
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    if min_price is not None:
        query = query.filter(Product.current_price >= min_price)
    if max_price is not None:
        query = query.filter(Product.current_price <= max_price)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    return query.limit(100).all()

@router.get("/{product_id}", response_model=schemas.ProductDetailOut)
def get_product_details(product_id: int, db: Session = Depends(get_db)):
    """Returns a single product and its full chronological price history."""
    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    history = db.query(PriceHistory).filter(
        PriceHistory.product_id == product_id
    ).order_by(PriceHistory.detected_at.asc()).all()

    return {
        "product": product,
        "price_history": history
    }