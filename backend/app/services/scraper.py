import json
import asyncio
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from ..models import Product, PriceHistory
from .notifier import send_price_change_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def async_retry(retries=3, delay=1):
    """Decorator that retries a failed async function up to `retries` times with exponential backoff."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for attempt in range(retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}: {e}")
                    if attempt == retries - 1:
                        logger.error(f"All {retries} attempts failed for {func.__name__}.")
                        raise
                    await asyncio.sleep(delay)
        return wrapper
    return decorator


@async_retry(retries=3, delay=2)
async def fetch_json_data(file_path: str):
    """Simulates an async network fetch by reading a local file. In production this would be an HTTP call."""
    await asyncio.sleep(0.1)
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_product_data(item: dict, source: str):
    """
    Normalises a raw marketplace item into a consistent schema.
    Each marketplace uses different field names, so we try multiple keys in priority order.
    """
    meta = item.get('metadata', {})

    raw_category = (
        item.get('category') or
        meta.get('garment_type') or   # Fashionphile
        meta.get('style') or          # Grailed
        item.get('brand') or          # 1stdibs fallback
        'Uncategorized'
    )

    category_str = str(raw_category).strip().lower()

    # Normalise into a cleaner, broader set of standard categories
    if 'belt' in category_str:
        final_category = 'Belts'
    elif 'bag' in category_str or 'purse' in category_str or 'tote' in category_str or 'clutch' in category_str:
        final_category = 'Bags'
    elif 'shirt' in category_str or 'tee' in category_str or 'top' in category_str or 'blouse' in category_str:
        final_category = 'Shirts'
    elif 'jacket' in category_str or 'coat' in category_str or 'outerwear' in category_str:
        final_category = 'Outerwear'
    elif 'shoe' in category_str or 'sneaker' in category_str or 'boot' in category_str or 'heel' in category_str:
        final_category = 'Shoes'
    elif 'jewelry' in category_str or 'jewellery' in category_str or 'necklace' in category_str or 'ring' in category_str or 'bracelet' in category_str:
        final_category = 'Jewelry'
    elif 'chanel' in category_str:
        final_category = 'Chanel'
    elif 'dress' in category_str:
        final_category = 'Dresses'
    else:
        final_category = 'Other / Accessories'

    return {
        "source_product_id": str(item.get('product_id') or item.get('id') or 'unknown'),
        "name": item.get('model') or item.get('name') or item.get('title') or 'Unknown Product',
        "category": final_category,
        "current_price": float(item.get('price') or 0.0),
        "url": item.get('product_url') or item.get('url') or '',
        "source_marketplace": source
    }


async def process_file(file_path: str, source_name: str, db: Session):
    """Ingests one marketplace data file: parses items, upserts products, records price history."""
    try:
        data = await fetch_json_data(file_path)

        if isinstance(data, list):
            items = data
        else:
            items = data.get('items') or data.get('data') or data.get('products') or data.get('results')
            if items is None and isinstance(data, dict) and ('name' in data or 'model' in data or 'title' in data):
                items = [data]
            elif items is None:
                items = []

        logger.info(f"Processing {len(items)} items from {file_path}")

        for item in items:
            parsed = extract_product_data(item, source_name)

            if not parsed["source_product_id"] or parsed["current_price"] == 0.0:
                continue

            product = db.query(Product).filter(
                Product.source_product_id == parsed["source_product_id"],
                Product.source_marketplace == parsed["source_marketplace"]
            ).first()

            if not product:
                product = Product(**parsed)
                db.add(product)
                # flush assigns product.id before the full transaction commits
                db.flush()
                db.add(PriceHistory(product_id=product.id, price=parsed["current_price"]))
            elif product.current_price != parsed["current_price"]:
                old_price = product.current_price
                new_price = parsed["current_price"]

                logger.info(f"Price change detected for '{product.name}': {old_price} -> {new_price}")

                product.current_price = new_price
                product.last_updated = datetime.utcnow()
                db.add(PriceHistory(product_id=product.id, price=new_price))

                # Fire-and-forget: notification runs off the main thread so it cannot delay ingestion
                asyncio.create_task(
                    send_price_change_notification(
                        product_name=product.name,
                        old_price=old_price,
                        new_price=new_price,
                        source=product.source_marketplace
                    )
                )

        db.commit()
        logger.info(f"Committed data for {file_path}")

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        db.rollback()
    except OSError as e:
        logger.error(f"Could not read file {file_path}: {e}")
        db.rollback()
    except SQLAlchemyError as e:
        logger.error(f"Database error while processing {file_path}: {e}")
        db.rollback()
    except Exception as e:
        # Catch-all safety net — logs unexpected errors without crashing the entire scrape run
        logger.exception(f"Unexpected error processing {file_path}: {e}")
        db.rollback()


async def run_all_scrapers(db: Session):
    """Orchestrates sequential ingestion of all local sample files.

    Files are processed one-at-a-time rather than concurrently because SQLite
    does not support write concurrency. Switching to PostgreSQL would allow
    concurrent processing across sources.
    """
    sample_dir = "sample_data"
    if not os.path.exists(sample_dir):
        logger.error("sample_data directory not found.")
        return

    SOURCE_MAP = {
        'grailed': 'Grailed',
        'fashionphile': 'Fashionphile',
        '1stdibs': '1stdibs',
    }

    for filename in os.listdir(sample_dir):
        if not filename.endswith('.json'):
            continue

        file_path = os.path.join(sample_dir, filename)
        name_lower = filename.lower()

        # Map filename to its marketplace name; skip unrecognised files
        source = next((v for k, v in SOURCE_MAP.items() if k in name_lower), None)
        if not source:
            logger.warning(f"Skipping unrecognised file: {filename}")
            continue

        await process_file(file_path, source, db)