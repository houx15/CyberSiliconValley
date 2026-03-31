from __future__ import annotations


async def refresh_graph(ctx: dict[str, object]) -> dict[str, str]:
    _ = ctx
    return {"status": "queued"}
