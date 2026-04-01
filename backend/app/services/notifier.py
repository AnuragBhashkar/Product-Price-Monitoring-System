import logging
import asyncio

logger = logging.getLogger(__name__)

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