from __future__ import annotations

from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from redis_layer.cache import get_redis_url

WORKER_QUEUE_NAME = "csv:worker:default"


def create_arq_settings(redis_url: str | None = None) -> RedisSettings:
    return RedisSettings.from_dsn(get_redis_url(redis_url))


async def create_queue(redis_url: str | None = None) -> ArqRedis:
    return await create_pool(create_arq_settings(redis_url))


async def enqueue_ping_job(queue: ArqRedis, value: str = "pong") -> object:
    return await queue.enqueue_job("ping", value, _queue_name=WORKER_QUEUE_NAME)


async def enqueue_match_scan(queue: ArqRedis, job_id: str) -> object:
    return await queue.enqueue_job("scan_matches", {"job_id": job_id}, _queue_name=WORKER_QUEUE_NAME)


async def enqueue_match_scan_job(redis_url: str | None, job_id: str) -> object:
    queue = await create_queue(redis_url)
    try:
        return await enqueue_match_scan(queue, job_id)
    finally:
        await queue.close(close_connection_pool=True)


async def enqueue_seeking_report_generation(queue: ArqRedis, talent_id: str) -> object:
    return await queue.enqueue_job("generate_seeking_report", {"talent_id": talent_id}, _queue_name=WORKER_QUEUE_NAME)


async def enqueue_seeking_report_job(redis_url: str | None, talent_id: str) -> object:
    queue = await create_queue(redis_url)
    try:
        return await enqueue_seeking_report_generation(queue, talent_id)
    finally:
        await queue.close(close_connection_pool=True)


async def enqueue_graph_refresh(queue: ArqRedis) -> object:
    return await queue.enqueue_job("refresh_graph", _queue_name=WORKER_QUEUE_NAME)


async def enqueue_graph_refresh_job(redis_url: str | None) -> object:
    queue = await create_queue(redis_url)
    try:
        return await enqueue_graph_refresh(queue)
    finally:
        await queue.close(close_connection_pool=True)
