from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class APIConsumer(Base):
    __tablename__ = "api_consumers"

    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, unique=True, index=True) # For API authentication
    consumer_name = Column(String)
    request_count = Column(Integer, default=0)        # Tracks usage per request

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    source_marketplace = Column(String, index=True) # e.g., 'Grailed', 'Fashionphile', '1stdibs'
    source_product_id = Column(String, index=True)
    name = Column(String)
    category = Column(String, index=True)
    current_price = Column(Float)
    url = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Links the product to all its historical prices
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")

class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    price = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="price_history")