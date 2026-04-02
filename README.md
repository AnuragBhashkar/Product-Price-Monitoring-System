# Entrupy Product Price Monitoring System

A full-stack, automated Product Price Monitoring System built to track competitor pricing across premium e-commerce marketplaces (Grailed, Fashionphile, 1stdibs). The architecture dynamically ingests product data, tracks sub-dollar price fluctuations over time, exposes robust analytical endpoints, reliably triggers webhook notifications upon price changes, and visualises the data in a beautiful dark-mode React application.

---

## 🚀 How to Run It (Quick Start Guide)

The application is heavily decoupled into two distinct tiers: the Python backend and the React frontend. **Both must be running.**

### 1. Start the Backend API
The backend runs on Python 3.9+ using FastAPI and SQLAlchemy.

```bash
# Navigate to the root directory
cd Product-Price-Monitoring-System

# Create and activate a virtual environment (optional but recommended)
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Mac/Linux: source .venv/bin/activate

# Install strictly pinned dependencies
pip install -r requirements.txt

# Start the uvicorn server with hot-reloading
python -m uvicorn backend.app.main:app --reload
```
The API is now alive at `http://127.0.0.1:8000`. You can view the interactive Swagger documentation by visiting `http://127.0.0.1:8000/docs`. By default, the database is seamlessly seeded with a `test_secret_key` API consumer.

### 2. Start the Frontend Dashboard
The frontend is a completely isolated React application built with Vite, Tailwind CSS v4, and Recharts.

```bash
# Open a second terminal window
cd Product-Price-Monitoring-System/frontend

# Install node dependencies
npm install

# Start the Vite development server
npm run dev
```
The dashboard is now viewable at `http://localhost:5173`. 

---

## 📂 Project Structure & Architecture

We chose a completely decoupled Monorepo architecture. 
* **Backend:** Built on FastAPI because native `async/await` support is critical for handling asynchronous webhook notifications and rapid data ingestion without blocking the event loop.
* **Frontend:** Built with React/Vite for blazingly fast Hot-Module Replacement (HMR) and a highly robust polling mechanism. The component-driven architecture makes building interactive charts and filtering grids incredibly maintainable.

```text
Product-Price-Monitoring-System/
├── backend/
│   ├── app/
│   │   ├── routers/        # Distinct route controllers (products, analytics, scraper, notifications)
│   │   ├── services/       # Core business logic (ingestion parsing, async notification retries)
│   │   ├── models.py       # SQLAlchemy ORM declarations (Products, PriceHistory, Notifications)
│   │   ├── schemas.py      # Strict Pydantic Data validation & serialization
│   │   ├── main.py         # App factory & async lifespan hook
│   ├── tests/              # E2E & Mock tests utilizing an isolated in-memory DB
├── frontend/
│   ├── src/
│   │   ├── Dashboard.jsx   # Primary grid, UI filters, and notification polling bridge
│   │   ├── ProductDetail.jsx # Recharts timeseries visualization
│   │   ├── api.js          # Axios API communication layer
├── sample_data/            # Source static JSON payloads simulating external vendor APIs
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 📖 Core API Documentation

**Authentication:** All protected endpoints require a valid API key passed in the headers: `x-api-key: test_secret_key`

### 1. Trigger Data Ingestion
- **Route:** `POST /scraper/run`
- **Description:** Kicks off an async task to ingest local marketplace JSONs. Automatically records `PriceHistory` deltas and fires database alerts if a price fluctuation is detected compared to the database.
- **Example Response:** (`200 OK`)
  ```json
  {
      "message": "Scraper started in the background. Check back in a few seconds!"
  }
  ```

### 2. Analytics Aggregation
- **Route:** `GET /analytics/`
- **Description:** Executes high-performance SQLAlchemy `group_by` aggregations to calculate average prices and total volumes across Marketplaces and Categories.
- **Example Response:** (`200 OK`)
  ```json
  {
    "by_source": [
      { "source_marketplace": "Grailed", "total_products": 60, "average_price": 530.25 }
    ],
    "by_category": [
      { "category": "Belts", "total_products": 14, "average_price": 280.0 }
    ]
  }
  ```

### 3. Fetch Notification Stream
- **Route:** `GET /notifications/`
- **Description:** Returns an unread stream of physical alerts mapped in SQLite for price drops. Fully powers the real-time React UI Toast polling mechanism.
- **Example Response:** (`200 OK`)
  ```json
  [
    {
      "id": 1,
      "message": "🚨 PRICE ALERT [1stdibs]: 'CHANEL Belt' changed from $300.0 to $2829.0.",
      "is_read": 0,
      "created_at": "2026-04-02T11:42:00Z"
    }
  ]
  ```

### 4. Fetch Single Product & Timeseries
- **Route:** `GET /products/{product_id}`
- **Description:** Returns the complete product schema coupled with a chronological array of historical price snapshots. Used by the frontend to render the UI visualization.

---

## 🧠 System Design & Architecture Decisions

#### 1. How does the price history scale? (Millions of Rows)
As a product's price history grows into millions of rows, querying a single product's detail page becomes a severe bottleneck. 
* **Current Solution:** I've applied explicit database indexing (`index=True`) on heavily queried Foreign Keys (`product_id`) and core search parameters. They are strictly linked via SQLAlchemy `cascade` instructions to prevent orphan data leaks.
* **Future Scaling:** If rows hit the multi-million mark globally, we would need to implement cursor-based pagination for the `GET /products/{id}` endpoint to avoid fetching massive JSON object blobs. Ultimately, the `PriceHistory` tables should be completely decoupled from the relational database and offloaded to a specialized Time-Series Database (TSDB) like InfluxDB or TimescaleDB, which drastically outperforms traditional relational constraints for chronological inserts and aggregations.

#### 2. How did you implement notification of price changes, and why that approach?
* **Approach:** When the data ingestion loop detects a price delta, it does two things simultaneously:
  1. Writes a persistent payload to our `Notification` SQLite table (which allows our React frontend UI polling to physically capture the event).
  2. Spawns an `asyncio.create_task()` to execute simulated external HTTP webhooks entirely off the main execution thread.
* **Reliability:** To completely prevent delivery failures (a strict assignment requirement), I engineered a custom `@async_notify_retry` decorator. If the simulated webhook delivery fails, it catches the error and retries up to 3 times with exponentially increasing timeouts before ultimately failing gracefully.
* **Why this approach?** This "fire-and-forget" approach is extremely robust and prevents network latency from blocking our core data-fetching parsing loop. I explicitly chose this over standing up a heavy message broker (like RabbitMQ, Kafka, or Celery) because it keeps the architecture radically simple to deploy and evaluate, while still fully satisfying the strict non-blocking delivery-guarantee requirements natively via standard library tools.

#### 3. How would you extend this system to 100+ data sources?
* **Abstract Base Classes:** We would ditch the massive, naive procedural `if/elif` block checking internal filenames. Instead, establish an `AbstractMarketplaceExtractor` class interface with `fetch_payload()` and `normalize_data()` methods. Each of the 100 sources becomes a small, decoupled subclass strictly implementing this interface context.
* **Config-Driven Scraping:** Rather than hardcoding structural parsing logic into the Python codebase, we'd store JSON paths/selectors in SQL mappings for each source. This way, adding the 101st source is just an administrative database entry, not a forced backend codebase deployment.
* **Distributed Task Queue:** We would transition from FastAPI's native `BackgroundTasks` to a distributed architecture using **Celery + Redis**. Scraping 100+ sources sequentially would totally overwhelm a single server. Utilizing Celery directly allows us to distribute the execution payload horizontally across an infinite, auto-scaling cluster of disconnected worker nodes.

---

## 🧪 Automated Testing

The backend includes a comprehensive test suite mapped inside `backend/tests/` utilizing isolated, in-memory SQLite databases (`sqlite:///:memory:`) to guarantee testing runs safely without corrupting local data. 

```bash
python -m pytest backend/tests/
```
There are **11 thorough tests** actively verifying system integrity (exceeding the strict requirement of 8), which cover:
1. End-to-end relational price history timelines.
2. Pydantic logic structural verification.
3. Complex query parameter filtering capabilities.
4. Protected API Key injection and rejection states.
5. Async scraping mock payload integrations and Category fallback logic.

---

## 🚧 Known Limitations (For Evaluation)

* **Database Engine Constraints:** The system currently relies on SQLite. In a deployed execution pipeline with high write concurrency (rapid, parallel price updates across 100+ sources simultaneously), SQLite database files will lock completely and severely suffer. Moving to native PostgreSQL is strictly mandated for a genuine production environment.
* **Static Payload Ingestion:** Our ingestion pipeline currently relies solely on static local JSON mock data. For live autonomous scraping, we'd aggressively need to implement network rate-limiting protocols, payload rotating proxy architecture, and User-Agent spoofing to avoid being instantly permanently IP-banned by high-end retailers like Fashionphile and 1stdibs.