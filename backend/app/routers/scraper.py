from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db

# Assuming your authentication dependency is in auth.py or dependencies.py
# If you don't have an auth file yet, you can temporarily remove the api_key dependency below
from ..auth import verify_api_key 

router = APIRouter()

@router.post("/run")
async def trigger_scraper(
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key) 
):
    # Import your actual scraping function from the services folder
    # Note: Replace 'run_all_scrapers' with whatever the actual function 
    # is called inside your backend/app/services/scraper.py file!
    from ..services.scraper import run_all_scrapers 
    
    # Run it as a background task so the API responds instantly
    background_tasks.add_task(run_all_scrapers, db)
    
    return {"message": "Scraper started in the background. Check back in a few seconds!"}