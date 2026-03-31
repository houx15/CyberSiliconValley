from __future__ import annotations


async def scan_matches(ctx: dict[str, object], payload: dict[str, str]) -> dict[str, str]:
    _ = ctx
    return {"job_id": payload["job_id"], "status": "queued"}
