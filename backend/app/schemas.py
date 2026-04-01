from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# Schema for the price history
class PriceHistoryResponse(BaseModel):
    id: int
    price: float
    detected_at: datetime  # Fixed to match models.py

    model_config = ConfigDict(from_attributes=True)

# Schema for the main product
class ProductResponse(BaseModel):
    id: int
    source_product_id: str
    source_marketplace: str
    name: str
    category: str
    current_price: float
    url: Optional[str] = None # <--- Update this line
    last_updated: datetime
    price_history: List[PriceHistoryResponse] = []

    model_config = ConfigDict(from_attributes=True)