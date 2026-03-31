from __future__ import annotations

from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from redis_layer.cache import get_redis_url


def create_arq_settings(redis_url: str | None = None) -> RedisSettings:
    return RedisSettings.from_dsn(get_redis_url(redis_url))


async def create_queue(redis_url: str | None = None) -> ArqRedis:
    return await create_pool(create_arq_settings(redis_url))


async def enqueue_ping_job(queue: ArqRedis, value: str = "pong") -> object:
    return await queue.enqueue_job("ping", value)
