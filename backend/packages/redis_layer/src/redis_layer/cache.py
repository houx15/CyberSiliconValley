from __future__ import annotations

import os

from redis.asyncio import Redis


def get_redis_url(redis_url: str | None = None) -> str:
    candidate = redis_url if redis_url is not None else os.getenv("REDIS_URL")
    if candidate is None or candidate.strip() == "":
        raise RuntimeError("REDIS_URL must be set")
    return candidate


def create_cache_client(redis_url: str | None = None) -> Redis:
    return Redis.from_url(get_redis_url(redis_url), decode_responses=True)
