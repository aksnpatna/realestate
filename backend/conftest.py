"""
conftest.py — Pytest configuration and fixtures for the Buyer Fit POC test suite.

- Isolates tests to TEST_DATABASE_URL (SQLite) by default.
- Fails fast if DATABASE_URL points to a non-test database.
- Provides DB session, schema, and model fixtures.
"""
import os
import sys
import pytest
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))


def _is_test_database(url: str) -> bool:
    if not url:
        return False
    url_lower = url.lower()
    if "test" in url_lower or ":memory:" in url_lower or url_lower.endswith(".test.sqlite") or url_lower.endswith(".test.db"):
        return True
    return False


def pytest_configure(config):
    url = os.getenv("DATABASE_URL", "")
    test_url = os.getenv("TEST_DATABASE_URL", "")
    if test_url:
        os.environ["DATABASE_URL"] = test_url
        url = test_url

    if url and "postgresql" in url.lower():
        if not _is_test_database(url):
            raise RuntimeError(
                f"REFUSING TO RUN TESTS: DATABASE_URL='{url}' does not appear to be a test database. "
                "Set TEST_DATABASE_URL=sqlite:///:memory: or TEST_DATABASE_URL=sqlite:///./test_poc.db "
                "before running the test suite."
            )

    if not url or "postgresql" in url.lower():
        db_path = os.getenv("TEST_DATABASE_URL", tempfile.mktemp(suffix=".test.sqlite"))
        if not db_path.startswith("sqlite://"):
            db_path = f"sqlite:///{db_path}"
        os.environ["DATABASE_URL"] = db_path
        os.environ["TEST_DATABASE_URL"] = db_path

    os.environ.setdefault("PUBLIC_POC_MODE", "true")
    os.environ.setdefault("PUBLIC_POC_MIN_DQ_SCORE", "80")
    os.environ.setdefault("DEMO_MODE", "false")
    os.environ.setdefault("ALLOW_MOCK_SUBURBS", "false")


@pytest.fixture(scope="session")
def test_db_url():
    return os.environ["DATABASE_URL"]


@pytest.fixture(scope="session")
def engine(test_db_url):
    from sqlalchemy import create_engine
    return create_engine(test_db_url, echo=False)


@pytest.fixture(scope="session")
def tables(engine):
    from models_v3 import Base
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    from models_v3 import SessionLocal
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
