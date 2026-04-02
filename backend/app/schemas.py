from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List


class PriceHistoryOut(BaseModel):
    id: int
    product_id: int
    price: float
    detected_at: datetime

    # Allows Pydantic to read attributes directly from SQLAlchemy ORM objects
    model_config = ConfigDict(from_attributes=True)


class ProductOut(BaseModel):
    id: int
    source_marketplace: str
    source_product_id: str
    name: str
    category: str
    current_price: float
    url: Optional[str] = None
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductDetailOut(BaseModel):
    product: ProductOut
    price_history: List[PriceHistoryOut]


class SourceStatOut(BaseModel):
    source_marketplace: str
    total_products: int
    average_price: float


class CategoryStatOut(BaseModel):
    category: str
    total_products: int
    average_price: float


class AnalyticsOut(BaseModel):
    by_source: List[SourceStatOut]
    by_category: List[CategoryStatOut]


class MessageResponse(BaseModel):
    message: str

class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)