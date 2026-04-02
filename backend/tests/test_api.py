import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models import APIConsumer, Product, PriceHistory

# Setup an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool 
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# Setup initial test data
@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Add a test API consumer
    test_consumer = APIConsumer(api_key="test_secret_key", consumer_name="Test User")
    db.add(test_consumer)
    
    # Add a test product
    test_product = Product(
        source_marketplace="Grailed",
        source_product_id="123",
        name="Vintage Jacket",
        category="Outerwear",
        current_price=150.0
    )
    db.add(test_product)
    db.commit()
    
    yield
    Base.metadata.drop_all(bind=engine)

# --- THE TESTS ---

def test_missing_api_key_rejected():
    """Edge Case: Ensure requests without an API key get 401 Unauthorized."""
    response = client.get("/products/")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API Key"

def test_invalid_api_key_rejected():
    """Edge Case: Ensure wrong API keys are rejected."""
    response = client.get("/products/", headers={"x-api-key": "wrong_key"})
    assert response.status_code == 401

def test_get_products_success():
    """Happy Path: Fetch products with valid authentication."""
    response = client.get("/products/", headers={"x-api-key": "test_secret_key"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Vintage Jacket"

def test_filter_products_by_category():
    """Meaningful Test: Ensure database filtering works correctly."""
    # Matches
    res1 = client.get("/products/?category=Outerwear", headers={"x-api-key": "test_secret_key"})
    assert len(res1.json()) == 1
    
    # Doesn't match
    res2 = client.get("/products/?category=Shoes", headers={"x-api-key": "test_secret_key"})
    assert len(res2.json()) == 0

def test_get_nonexistent_product():
    """Edge Case: Requesting a product ID that doesn't exist."""
    response = client.get("/products/999", headers={"x-api-key": "test_secret_key"})
    assert response.status_code == 404


def test_get_product_details_with_history():
    """
    Happy Path + Structure: The detail endpoint must return both a 'product' object
    and a 'price_history' array. We seed one history record to confirm it is returned
    chronologically.
    """
    # Seed a price history entry for the test product (id=1)
    db = TestingSessionLocal()
    db.add(PriceHistory(product_id=1, price=150.0))
    db.commit()
    db.close()

    response = client.get("/products/1", headers={"x-api-key": "test_secret_key"})
    assert response.status_code == 200

    data = response.json()
    assert "product" in data
    assert "price_history" in data
    assert data["product"]["name"] == "Vintage Jacket"
    assert isinstance(data["price_history"], list)
    assert len(data["price_history"]) == 1
    assert data["price_history"][0]["price"] == 150.0


def test_filter_products_by_price_range():
    """
    Meaningful Test: Validates that min_price and max_price query params correctly
    filter products. Both the inclusive lower bound and exclusive upper bound are tested.
    """
    headers = {"x-api-key": "test_secret_key"}

    # Product price is 150.0 — should be included when min=100
    res = client.get("/products/?min_price=100", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # Should be excluded when min_price is above the product's price
    res = client.get("/products/?min_price=200", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 0

    # Should be included when max_price is above the product's price
    res = client.get("/products/?max_price=200", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1

    # Should be excluded when max_price is below the product's price
    res = client.get("/products/?max_price=100", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 0


def test_analytics_endpoint_returns_correct_structure():
    """
    Regression Guard: Validates the analytics endpoint returns the exact field
    names the frontend depends on. Guards against future renaming regressions.
    """
    response = client.get("/analytics/", headers={"x-api-key": "test_secret_key"})
    assert response.status_code == 200

    data = response.json()
    assert "by_source" in data
    assert "by_category" in data

    # Validate field names on the source breakdown (guards against the source/count mix-up)
    assert len(data["by_source"]) == 1
    source_entry = data["by_source"][0]
    assert "source_marketplace" in source_entry
    assert "total_products" in source_entry
    assert "average_price" in source_entry
    assert source_entry["source_marketplace"] == "Grailed"
    assert source_entry["total_products"] == 1

    # Validate field names on the category breakdown
    assert len(data["by_category"]) == 1
    category_entry = data["by_category"][0]
    assert "category" in category_entry
    assert "average_price" in category_entry
    assert category_entry["category"] == "Outerwear"