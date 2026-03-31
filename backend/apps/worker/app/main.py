from __future__ import annotations

import asyncio
import os

from arq.worker import Worker

from app.jobs.ping import ping
from redis_layer.queue import create_arq_settings


def build_worker(
    redis_url: str | None = None,
    *,
    burst: bool = False,
    max_burst_jobs: int = 1,
) -> Worker:
    return Worker(
        functions=[ping],
        redis_settings=create_arq_settings(redis_url),
        burst=burst,
        max_burst_jobs=max_burst_jobs,
    )


async def run_worker(redis_url: str | None = None) -> None:
    worker = build_worker(redis_url)
    try:
        await worker.async_run()
    finally:
        await worker.close()


def main() -> None:
    redis_url = os.getenv("REDIS_URL")
    asyncio.run(run_worker(redis_url))


if __name__ == "__main__":
    main()
