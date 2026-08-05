"""
Shared pytest fixtures for the HostWise backend.

⚠️ IMPORTANT: environment variables MUST be set before importing the app
so the module-level async engine binds to a throwaway test database.
"""
import os
import tempfile

TEST_DIR = tempfile.mkdtemp(prefix="hostwise-test-")
os.environ["SQLITE_PATH"] = os.path.join(TEST_DIR, "test.db")
os.environ["DATABASE_TYPE"] = "sqlite"
os.environ["UPLOAD_DIR"] = os.path.join(TEST_DIR, "uploads")
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import Base, engine
from app.main import create_app

app = create_app()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    # Import every model module so `Base.metadata` is fully populated.
    from app.finance import models  # noqa: F401
    from app.properties import models  # noqa: F401
    from app.reservations import models  # noqa: F401
    from app.settings import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    """Truncate all tables after every test for full isolation."""
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for the FastAPI app (no live server needed)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── Helpers for seeding data ──────────────────────────────
@pytest_asyncio.fixture
async def seed_property(client):
    """Create a single property via the API and return its UUID string."""
    resp = await client.post(
        "/api/v1/properties",
        json={"name": "Test Villa", "city": "Lisbon", "country": "Portugal",
              "bedrooms": 3, "bathrooms": 2, "max_guests": 6,
              "target_annual_revenue": 60000},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
