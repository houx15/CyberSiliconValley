from __future__ import annotations

import asyncio
import os

from arq.worker import Worker

from csv_worker.jobs.graph import refresh_graph
from csv_worker.jobs.matching import scan_matches
from csv_worker.jobs.ping import ping
from csv_worker.jobs.seeking import generate_seeking_report
from redis_layer.queue import WORKER_QUEUE_NAME, create_arq_settings


def build_worker(
    redis_url: str | None = None,
    *,
    burst: bool = False,
    max_burst_jobs: int = 1,
) -> Worker:
    return Worker(
        functions=[ping, scan_matches, generate_seeking_report, refresh_graph],
        redis_settings=create_arq_settings(redis_url),
        queue_name=WORKER_QUEUE_NAME,
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
