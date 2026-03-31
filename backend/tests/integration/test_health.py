from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from csv_api.main import app


@pytest.mark.anyio
async def test_health_endpoint_returns_ok() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


@pytest.mark.anyio
async def test_ready_endpoint_returns_dependency_shape() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "version": "0.1.0",
        "dependencies": {
            "database": {"status": "unknown"},
            "redis": {"status": "unknown"},
        },
    }
