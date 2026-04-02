from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import verify_api_key
from .. import schemas

router = APIRouter()

@router.post("/run", response_model=schemas.MessageResponse)
async def trigger_scraper(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    from ..services.scraper import run_all_scrapers
    background_tasks.add_task(run_all_scrapers, db)
    return {"message": "Scraper started in the background. Check back in a few seconds!"}