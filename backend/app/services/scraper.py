import json
import asyncio
import os
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from backend.app.models import Product, PriceHistory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# 1. RETRY LOGIC (Required by Assignment)
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
# 2. ASYNC FETCHING (Required by Assignment)
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
    # This is a generic extractor. It tries common keys.
    return {
        "source_product_id": str(item.get('id') or item.get('productId') or item.get('uuid', 'unknown')),
        "name": item.get('name') or item.get('title') or 'Unknown Product',
        "category": item.get('category') or 'Uncategorized',
        "current_price": float(item.get('price') or item.get('currentPrice') or item.get('amount') or 0.0),
        "url": item.get('url') or item.get('productUrl') or '',
        "source_marketplace": source
    }

async def process_file(file_path: str, source_name: str, db: Session):
    """Fetches data from a file and updates the database."""
    try:
        data = await fetch_json_data(file_path)
        
        # Some JSONs are lists, some are dicts wrapping a list. We ensure it's a list here.
        items = data if isinstance(data, list) else data.get('items', data.get('data', []))
        
        for item in items:
            parsed = extract_product_data(item, source_name)
            
            # Skip invalid data
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
                    logger.info(f"Price change detected for {product.name}: {product.current_price} -> {parsed['current_price']}")
                    
                    product.current_price = parsed["current_price"]
                    product.last_updated = datetime.utcnow()
                    
                    # Record the new price in history
                    history = PriceHistory(product_id=product.id, price=parsed["current_price"])
                    db.add(history)
                    
                    # TODO: Trigger Notification System Here (We will build this later)
            
        db.commit()
        logger.info(f"Successfully processed {file_path}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to process {file_path}: {e}")

async def run_all_scrapers(db: Session):
    """Orchestrates the scraping of all local sample files concurrently."""
    sample_dir = "sample_data"
    if not os.path.exists(sample_dir):
        logger.error("sample_data directory not found!")
        return

    tasks = []
    for filename in os.listdir(sample_dir):
        if not filename.endswith('.json'):
            continue
            
        file_path = os.path.join(sample_dir, filename)
        
        # Determine source marketplace from filename (e.g., 'grailed_...', '1stdibs_...')
        if 'grailed' in filename.lower():
            source = 'Grailed'
        elif 'fashionphile' in filename.lower():
            source = 'Fashionphile'
        elif '1stdibs' in filename.lower():
            source = '1stdibs'
        else:
            source = 'Unknown'

        # Create an async task for each file
        tasks.append(process_file(file_path, source, db))
        
    # Run them all concurrently
    await asyncio.gather(*tasks)