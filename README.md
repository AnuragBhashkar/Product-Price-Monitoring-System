# Product Price Monitoring System

This is a full-stack Product Price Monitoring System built to track competitor pricing across various e-commerce marketplaces (Grailed, Fashionphile, 1stdibs). The backend dynamically ingests product data, tracks price changes over time, exposes robust analytical endpoints, and reliably triggers notifications upon price changes.

---

## 🚀 How to Run It

### Setup the Backend
The backend runs on Python 3.9+ using FastAPI and SQLAlchemy (with SQLite).

1. **Navigate to the backend directory and activate your virtual environment (if you use one):**
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the FastAPI server:**
   ```bash
   # Make sure you are in the root directory (Product-Price-Monitoring-System)
   python -m uvicorn backend.app.main:app --reload
   ```

The API will now be running at `http://127.0.0.1:8000`. You can view the interactive Swagger documentation by visiting `http://127.0.0.1:8000/docs`.

### Run the Test Suite
```bash
python -m pytest backend/tests/
```
There are 8 thorough tests validating edge cases (auth failures, missing keys) and specific business logic (retry decorators).

---

## 📖 API Documentation

**Authentication:** All endpoints require an API key passed in the headers: `x-api-key: test_secret_key`

### 1. Trigger Data Refresh
- **Endpoint:** `POST /scraper/run`
- **Description:** Triggers the async ingestion of marketplace data in the background. It will automatically detect price changes and fire webhook simulations.
- **Response:**
  ```json
  {
      "message": "Scraper started in the background. Check back in a few seconds!"
  }
  ```

### 2. Browse & Filter Products
- **Endpoint:** `GET /products/`
- **Query Params:** `source` (str), `category` (str), `min_price` (float), `max_price` (float), `search` (str)
- **Description:** Returns a list of products matching the filters (limited to 100 for performance).
- **Example Call:** `GET /products/?category=Outerwear&min_price=100`

### 3. Get Single Product & Price History
- **Endpoint:** `GET /products/{product_id}`
- **Description:** Returns the product's metadata along with its chronological price history array.
- **Example Response:**
  ```json
  {
      "product": { ... },
      "price_history": [
          {"id": 1, "price": 150.0, "detected_at": "2023-10-01T12:00:00Z"},
          {"id": 2, "price": 120.0, "detected_at": "2023-10-05T12:00:00Z"}
      ]
  }
  ```

### 4. Fetch Aggregate Analytics
- **Endpoint:** `GET /analytics/`
- **Description:** Computes and returns the total amount of products and average price grouped by marketplace and category.

---

## 🧠 Design Decisions & Architecture

### 1. How does the price history scale? (Millions of Rows)
As a product's price history grows into millions of rows, querying a single product's detail page becomes a major bottleneck. 
* **Current Solution:** I've applied explicit database indexing (`index=True`) on Foreign Keys (`product_id`) and search parameters. I also linked them via a SQLAlchemy `cascade` to prevent orphan data leaks.
* **Future Scaling:** If rows hit the multi-million mark globally, we would need to implement cursor-based pagination for the `GET /products/{id}` endpoint to avoid fetching massive data blobs. Ultimately, the `PriceHistory` model should be offloaded to a specialized Time-Series Database (TSDB) like TimescaleDB, which drastically outperforms SQLite/Postgres for chronological inserts.

### 2. How did you implement notification of price changes, and why that approach?
* **Approach:** When the scraper detects a price change during DB upserts, it uses `asyncio.create_task()` to execute physical notifications off the main thread. 
* **Reliability:** To prevent delivery failures (a strict requirement), I wrote a custom `@async_notify_retry` decorator. If the simulated webhook delivery fails, it automatically catches the error, sleeps, and retries up to 3 times before logging the failure.
* **Why this approach?** This "fire-and-forget" approach is extremely lightweight and prevents a delayed webhook from blocking our core data-fetching process. I chose this over a heavy message broker (like RabbitMQ or Kafka) because it keeps the architecture radically simple to deploy while fully satisfying the strict non-blocking and delivery-guarantee requirements for this assignment.

### 3. How would you extend this system to 100+ data sources?
* **Abstract Base Classes:** We would ditch the massive `if/elif` block checking filenames. Instead, establish an `AbstractMarketplaceExtractor` class interface with `fetch()` and `normalize()` methods. Each of the 100 sources becomes a small decoupled subclass.
* **Config-Driven Scraping:** Rather than hardcoding parsing logic, we'd store JSON paths/selectors in a database map for each source. This way, adding the 101st source is just a database entry, not a code deployment.
* **Distributed Task Queue:** We would transition from basic `BackgroundTasks` to **Celery + Redis**. Scraping 100+ sources would overwhelm a single server; Celery would allow us to distribute the scraping workload horizontally across an array of worker nodes.

---

## 🚧 Known Limitations

* **Database Engine:** The system currently defaults to SQLite for ease of evaluation. In a real-world scenario with high write concurrency (running rapid price updates), SQLite will hit lock contention. Moving to PostgreSQL is highly recommended if deployed.
* **Data Sources Details:** We are relying on static local JSON. If network rates fluctuate, we'd need to implement rate-limiting logic on outgoing HTTP requests to avoid IP bans from Grailed, 1stdibs, etc.
* **Frontend UI:** Currently, the focus is entirely heavily weighted on the robust backend logic, meaning the visualization interface is minimal/placeholder and requires further React/Vue integration to query the exposed endpoints seamlessly.