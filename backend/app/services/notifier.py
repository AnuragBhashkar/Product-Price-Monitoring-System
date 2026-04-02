import logging
import asyncio

logger = logging.getLogger(__name__)

def async_notify_retry(retries=3, delay=1):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for attempt in range(retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logger.warning(f"Notification attempt {attempt + 1} failed: {e}")
                    if attempt == retries - 1:
                        logger.error(f"Failed to deliver notification after {retries} attempts.")
                        # In a real system, you'd log this event to a Dead Letter Queue or Database
                    await asyncio.sleep(delay)
        return wrapper
    return decorator

@async_notify_retry(retries=3, delay=2)
async def send_price_change_notification(product_name: str, old_price: float, new_price: float, source: str):
    """
    Simulates sending an async webhook or email notification.
    In a production system, this would push to a queue (RabbitMQ/Kafka) 
    or make an HTTP POST request to a consumer's webhook URL.
    """
    # Simulate the network delay of sending a webhook
    await asyncio.sleep(0.5)
    
    message = (
        f"🚨 PRICE ALERT [{source}]: '{product_name}' "
        f"changed from ${old_price} to ${new_price}."
    )
    
    # In reality, this would be an actual API call to a subscriber
    logger.info(f"WEBHOOK DELIVERED: {message}")
    
    return True