from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import APIConsumer

def verify_api_key(x_api_key: str = Header(...), db: Session = Depends(get_db)):
    """Verifies the API key and tracks consumer usage."""
    # Look up the consumer in the database
    consumer = db.query(APIConsumer).filter(APIConsumer.api_key == x_api_key).first()
    
    if not consumer:
        # If no key exists in the DB, reject the request
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    
    # Increment their usage count
    consumer.request_count += 1
    db.commit()
    
    return consumer