from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Notification
from ..schemas import NotificationOut
from ..auth import verify_api_key

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(verify_api_key)]
)

@router.get("/", response_model=List[NotificationOut])
def get_unread_notifications(db: Session = Depends(get_db)):
    """Fetch all unread notifications to display on the frontend."""
    notifications = db.query(Notification).filter(Notification.is_read == 0).order_by(Notification.created_at.desc()).all()
    return notifications

@router.post("/{notification_id}/mark-read", status_code=status.HTTP_200_OK)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read so it stops polling."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = 1
    db.commit()
    return {"message": "Notification marked as read"}
