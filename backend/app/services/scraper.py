import json
import asyncio
import os
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from backend.app.models import Product, PriceHistory
from backend.app.services.notifier import send_price_change_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# 1. RETRY LOGIC
# ==========================================
def async_retry(retries=3, delay=1):
    """Decorator to automatically retry failed async operations."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for attempt in range(retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}: {e}")
                    if attempt == retries - 1:
                        logger.error(f"All {retries} attempts failed.")
                        raise
                    await asyncio.sleep(delay)
        return wrapper
    return decorator

# ==========================================
# 2. ASYNC FETCHING
# ==========================================
@async_retry(retries=3, delay=2)
async def fetch_json_data(file_path: str):
    """Simulates an async network fetch by reading the local file asynchronously."""
    await asyncio.sleep(0.1) # Simulate network latency
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

# ==========================================
# 3. DATA PARSING & STORING
# ==========================================
def extract_product_data(item: dict, source: str):
    """Safely extracts data regardless of the marketplace schema."""
    
    # Safely get metadata dictionary if it exists
    meta = item.get('metadata', {})
    
    # Extract category based on what each marketplace provides
    raw_category = (
        item.get('category') or 
        meta.get('garment_type') or  # Fashionphile uses this
        meta.get('style') or         # Grailed uses this
        item.get('brand') or         # 1stdibs fallback
        'Uncategorized'
    )

    # --- NEW CLEANUP RULE ---
    category_str = str(raw_category).strip()
    
    # If it's a massive dump of text...
    if len(category_str) > 35:
        # If there's a colon (e.g., "Fashion Belt: PENDANT SHAPE..."), split and keep the first part
        if ":" in category_str:
            category_str = category_str.split(":")[0].strip()
        else:
            # Otherwise, gracefully truncate around 30 chars without cutting words in half
            category_str = category_str[:30].rsplit(' ', 1)[0] + "..."
            
    if not category_str:
        category_str = 'Uncategorized'
    # ------------------------

    return {
        "source_product_id": str(item.get('product_id') or item.get('id') or 'unknown'),
        "name": item.get('model') or item.get('name') or item.get('title') or 'Unknown Product',
        "category": category_str,
        "current_price": float(item.get('price') or 0.0),
        "url": item.get('product_url') or item.get('url') or '',
        "source_marketplace": source
    }

async def process_file(file_path: str, source_name: str, db: Session):
    """Fetches data from a file and updates the database."""
    try:
        data = await fetch_json_data(file_path)
        
        # More robust extraction - checks common keys or wraps a single dict in a list
        if isinstance(data, list):
            items = data
        else:
            items = data.get('items') or data.get('data') or data.get('products') or data.get('results')
            # If it's a single dictionary item, wrap it in a list
            if items is None and isinstance(data, dict) and ('name' in data or 'model' in data or 'title' in data):
                items = [data]
            elif items is None:
                items = []

        # LOG THE COUNT SO WE CAN SEE IT!
        logger.info(f"Found {len(items)} items to process in {file_path}")

        for item in items:
            parsed = extract_product_data(item, source_name)
            
            if not parsed["source_product_id"] or parsed["current_price"] == 0.0:
                continue

            # 1. Check if product already exists
            product = db.query(Product).filter(
                Product.source_product_id == parsed["source_product_id"],
                Product.source_marketplace == parsed["source_marketplace"]
            ).first()

            if not product:
                # Create new product
                product = Product(**parsed)
                db.add(product)
                db.flush() # Get the product.id without committing yet
                
                # Add initial price history
                history = PriceHistory(product_id=product.id, price=parsed["current_price"])
                db.add(history)
            else:
                # 2. Check for PRICE CHANGE
                if product.current_price != parsed["current_price"]:
                    old_price = product.current_price
                    new_price = parsed["current_price"]
                    
                    logger.info(f"Price change detected for {product.name}: {old_price} -> {new_price}")
                    
                    product.current_price = new_price
                    product.last_updated = datetime.utcnow()
                    
                    # Record the new price in history
                    history = PriceHistory(product_id=product.id, price=new_price)
                    db.add(history)
                    
                    # TRIGGER NOTIFICATION (Fire and forget, doesn't block scraper)
                    asyncio.create_task(
                        send_price_change_notification(
                            product_name=product.name,
                            old_price=old_price,
                            new_price=new_price,
                            source=product.source_marketplace
                        )
                    )
            
        db.commit()
        logger.info(f"Successfully committed data for {file_path}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to process {file_path}: {e}")

async def run_all_scrapers(db: Session):
    """Orchestrates the scraping of all local sample files sequentially to protect the DB session."""
    sample_dir = "sample_data"
    if not os.path.exists(sample_dir):
        logger.error("sample_data directory not found!")
        return

    # Process files sequentially instead of concurrent gather
    for filename in os.listdir(sample_dir):
        if not filename.endswith('.json'):
            continue
            
        file_path = os.path.join(sample_dir, filename)
        
        # Determine source marketplace from filename
        if 'grailed' in filename.lower():
            source = 'Grailed'
        elif 'fashionphile' in filename.lower():
            source = 'Fashionphile'
        elif '1stdibs' in filename.lower():
            source = '1stdibs'
        else:
            source = 'Unknown'

        # await EACH file one by one so the DB session doesn't get locked/confused
        await process_file(file_path, source, db)