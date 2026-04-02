import pytest
import asyncio
from backend.app.services.scraper import extract_product_data, async_retry

def test_extract_product_data_standard():
    """Happy Path: Parsing standard JSON payload."""
    mock_data = {
        "id": "abc-123",
        "name": "Chanel Bag",
        "category": "Accessories",
        "price": 2500.0,
        "url": "http://example.com/bag"
    }
    result = extract_product_data(mock_data, "1stdibs")
    
    assert result["source_product_id"] == "abc-123"
    assert result["current_price"] == 2500.0
    assert result["source_marketplace"] == "1stdibs"

def test_extract_product_data_fallback_keys():
    """Edge Case: Parsing JSON with alternative key names (e.g., product_id instead of id)."""
    mock_data = {
        "product_id": "xyz-999",
        "model": "Rolex Watch",
        "price": 5000.0
    }
    result = extract_product_data(mock_data, "Fashionphile")
    
    assert result["source_product_id"] == "xyz-999"
    assert result["name"] == "Rolex Watch"
    assert result["current_price"] == 5000.0
    assert result["category"] == "Other / Accessories" # Default fallback

@pytest.mark.asyncio
async def test_retry_decorator_success_after_failure():
    """Meaningful Test: Ensure the retry logic actually retries."""
    attempts = 0
    
    @async_retry(retries=3, delay=0.1)
    async def flaky_function():
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise ValueError("Failed on first try")
        return "Success!"
        
    result = await flaky_function()
    assert result == "Success!"
    assert attempts == 2 # Proves it failed once, retried, and succeeded