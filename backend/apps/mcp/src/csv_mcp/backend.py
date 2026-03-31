from __future__ import annotations

import os
from typing import Any

import httpx


DEFAULT_API_BASE_URL = "http://localhost:8000"


class BackendApiError(RuntimeError):
    def __init__(self, *, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


class BackendClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        resolved_base_url = (base_url or os.getenv("CSV_API_URL") or DEFAULT_API_BASE_URL).rstrip("/")
        self._client = httpx.Client(
            base_url=resolved_base_url,
            transport=transport,
            timeout=10.0,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._client.close()

    def authenticate(self, *, email: str, password: str) -> dict[str, Any]:
        return self._request("POST", "/api/v1/auth/login", json={"email": email, "password": password})

    def read_profile(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/profile")

    def list_matches(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/matches")

    def list_inbox(self, *, filter_value: str = "all") -> dict[str, Any]:
        return self._request("GET", "/api/v1/inbox", params={"filter": filter_value})

    def read_graph(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/graph")

    def read_keyword_jobs(self, *, keyword: str, job_id: str | None = None) -> dict[str, Any]:
        params = {"jobId": job_id} if job_id else None
        return self._request("GET", f"/api/v1/graph/{keyword}/jobs", params=params)

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = self._client.request(method, path, **kwargs)
        if response.status_code >= 400:
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            message = payload.get("message") or payload.get("error") or response.text or "Backend request failed"
            raise BackendApiError(status_code=response.status_code, message=message)
        if not response.content:
            return {}
        return response.json()
