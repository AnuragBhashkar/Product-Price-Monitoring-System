from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Product
from ..dependencies import verify_api_key

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(verify_api_key)]
)

@router.get("/")
def get_analytics(db: Session = Depends(get_db)):
    """Get aggregate analytics: totals by source and averages by category."""
    
    # 1. Calculate totals and averages grouped by Source Marketplace
    source_stats = db.query(
        Product.source_marketplace, 
        func.count(Product.id).label("total_products"),
        func.avg(Product.current_price).label("average_price")
    ).group_by(Product.source_marketplace).all()

    # 2. Calculate totals and averages grouped by Category
    category_stats = db.query(
        Product.category, 
        func.count(Product.id).label("total_products"),
        func.avg(Product.current_price).label("average_price")
    ).group_by(Product.category).all()

    # Format and return the data securely
    return {
        "by_source": [
            {
                "source_marketplace": row.source_marketplace, 
                "total_products": row.total_products, 
                "average_price": round(row.average_price or 0, 2)
            }
            for row in source_stats
        ],
        "by_category": [
            {
                "category": row.category, 
                "total_products": row.total_products, 
                "average_price": round(row.average_price or 0, 2)
            }
            for row in category_stats
        ]
    }