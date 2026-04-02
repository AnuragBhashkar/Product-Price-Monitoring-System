# Entrupy Product Price Monitoring System

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

A full-stack, automated Product Price Monitoring System built to track competitor pricing across premium e-commerce marketplaces (Grailed, Fashionphile, 1stdibs). The architecture dynamically ingests product data, tracks sub-dollar price fluctuations over time, exposes robust analytical endpoints, reliably triggers webhook notifications upon price changes, and visualises the data in a beautiful dark-mode React application.

---

## 🚀 Quick Start Guide

The application is split into two distinct tiers: the Python backend and the React frontend. Both must be running.

### 1. Start the Backend API
The backend runs on Python 3.9+ using FastAPI and SQLAlchemy.

```bash
# Navigate to the root directory
cd Product-Price-Monitoring-System

# Create and activate a virtual environment (optional but recommended)
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Mac/Linux: source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the uvicorn server
python -m uvicorn backend.app.main:app --reload
```
The API is now alive at `http://127.0.0.1:8000`. You can view the interactive Swagger documentation by visiting `http://127.0.0.1:8000/docs`. By default, the database is seeded with a `test_secret_key` API consumer.

### 2. Start the Frontend Dashboard
The frontend is a React application built with Vite, Tailwind CSS v4, and Recharts.

```bash
# Open a second terminal window
cd Product-Price-Monitoring-System/frontend

# Install node dependencies
npm install

# Start the Vite development server
npm run dev
```
The beautiful dashboard is now viewable at `http://localhost:5173`. 

---

## 🧪 Automated Testing

The backend includes a comprehensive test suite that uses an isolated, in-memory SQLite database (`sqlite:///:memory:`) to guarantee tests run safely without corrupting your local application state. 

```bash
python -m pytest backend/tests/
```
There are **8 thorough tests** actively verifying system integrity, covering:
1. End-to-end price history timelines
2. Pydantic analytics structures
3. Query-parameter filtering combinations
4. API Key injection and failure states
5. Async scraping mock integrations

---

## 📖 Core API Documentation

**Authentication:** All protected endpoints require a valid API key passed in the headers: `x-api-key: test_secret_key`

### 1. Trigger Data Ingestion
- **Endpoint:** `POST /scraper/run`
- **Description:** Kicks off an async background task to ingest local marketplace JSONs. Automatically records `PriceHistory` deltas and fires non-blocking mock webhooks if a price fluctuation is detected compared against the database state.
- **Response:** `200 OK`
  ```json
  {
      "message": "Scraper started in the background. Check back in a few seconds!"
  }
  ```

### 2. Analytics Aggregation
- **Endpoint:** `GET /analytics/`
- **Description:** Executes high-performance SQLAlchemy `group_by` aggregations to calculate average prices and total volumes across Marketplaces and Categories.
- **Example Response:**
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

### 3. Fetch Single Product & Timeseries
- **Endpoint:** `GET /products/{product_id}`
- **Description:** Returns the complete product schema coupled with a chronological array of historical price snapshots. Used by the frontend to render the Recharts visualization.

---

## 🧠 System Design & Architecture Decisions

#### 1. How does the price history scale? (Millions of Rows)
As a product's price history grows into millions of rows, querying a single product's detail page becomes a major bottleneck. 
* **Current Solution:** I've applied explicit database indexing (`index=True`) on heavily queried Foreign Keys (`product_id`) and search parameters. I also linked them via a SQLAlchemy `cascade` to prevent orphan data leaks.
* **Future Scaling:** If rows hit the multi-million mark globally, we would need to implement cursor-based pagination for the `GET /products/{id}` endpoint to avoid fetching massive JSON blobs. Ultimately, the `PriceHistory` database model should be decoupled from the relational database and offloaded to a specialized Time-Series Database (TSDB) like TimescaleDB, which drastically outperforms SQLite/Postgres for chronological inserts.

#### 2. How did you implement notification of price changes, and why that approach?
* **Approach:** When the scraper detects a price delta during a database update, it uses `asyncio.create_task()` to execute physical HTTP webhook notifications off the main execution thread. 
* **Reliability:** To prevent delivery failures (a strict requirement), I wrote a custom `@async_notify_retry` decorator. If the simulated webhook delivery fails, it automatically catches the error, sleeps, and retries up to 3 times with exponential backoff before eventually logging the failure.
* **Why this approach?** This "fire-and-forget" approach is extremely lightweight and prevents a delayed webhook from blocking our core data-fetching ingestion loop. I chose this over standing up a heavy message broker (like RabbitMQ or Kafka) because it keeps the architecture radically simple to deploy and evaluate, while fully satisfying the strict non-blocking delivery-guarantee requirements.

#### 3. How would you extend this system to 100+ data sources?
* **Abstract Base Classes:** We would ditch the massive procedural `if/elif` block checking filenames. Instead, establish an `AbstractMarketplaceExtractor` class interface with `fetch()` and `normalize()` methods. Each of the 100 sources becomes a small decoupled subclass implementing the interface.
* **Config-Driven Scraping:** Rather than hardcoding parsing logic into the Python codebase, we'd store JSON paths/selectors in a database map for each source. This way, adding the 101st source is just a database entry, not a code deployment.
* **Distributed Task Queue:** We would transition from FastAPI's basic `BackgroundTasks` to **Celery + Redis**. Scraping 100+ sources sequentially would overwhelm a single server; Celery would allow us to distribute the scraping workload horizontally across an auto-scaling cluster of worker nodes.

---

## 🚧 Known Limitations (For Evaluation)

* **Database Engine:** The system currently defaults to SQLite. In a deployed scenario with high write concurrency (rapid, parallel price updates across sources), SQLite will suffer from lock contention. Moving to PostgreSQL is highly recommended for production.
* **Static Ingestion:** We are relying on static local JSON. For live scraping, we'd need to implement rate-limiting and proxy-rotation logic on outgoing HTTP requests to avoid IP bans from Grailed, 1stdibs, etc.