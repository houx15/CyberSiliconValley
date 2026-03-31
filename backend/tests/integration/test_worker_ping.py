from __future__ import annotations

import os

import pytest

from csv_worker.main import build_worker
from redis_layer.queue import create_queue, enqueue_ping_job


REDIS_URL = os.getenv("REDIS_URL")

pytestmark = pytest.mark.skipif(not REDIS_URL, reason="REDIS_URL is required")


@pytest.mark.anyio
async def test_worker_ping_result_is_observable() -> None:
    queue = await create_queue(REDIS_URL)
    worker = build_worker(REDIS_URL, burst=True, max_burst_jobs=10)

    try:
        job = await enqueue_ping_job(queue, "pong")

        await worker.async_run()

        assert await job.result(timeout=5, poll_delay=0.1) == {"value": "pong"}
    finally:
        await worker.close()
        await queue.close(close_connection_pool=True)
