from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Creates a local SQLite file named price_monitor.db at the root level
SQLALCHEMY_DATABASE_URL = "sqlite:///./price_monitor.db"

# connect_args={"check_same_thread": False} is strictly required for SQLite in FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to yield database sessions for our API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()