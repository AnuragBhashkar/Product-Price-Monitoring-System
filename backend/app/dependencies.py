from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from .database import get_db
from .models import APIConsumer

def verify_api_key(x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Verifies the API key and tracks consumer usage."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")

    consumer = db.query(APIConsumer).filter(APIConsumer.api_key == x_api_key).first()
    
    if not consumer:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    
    consumer.request_count += 1
    db.commit()
    
    return consumer