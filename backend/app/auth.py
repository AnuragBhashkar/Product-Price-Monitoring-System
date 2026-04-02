from fastapi import Security, HTTPException, Depends
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from .database import get_db
from .models import APIConsumer

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)

def verify_api_key(
    api_key: str = Security(api_key_header),
    db: Session = Depends(get_db)
):
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")

    consumer = db.query(APIConsumer).filter(APIConsumer.api_key == api_key).first()
    if not consumer:
        raise HTTPException(status_code=401, detail="Invalid or missing API Key")

    # Increment per-request usage so each consumer's call volume is auditable
    consumer.request_count += 1
    db.commit()

    return api_key