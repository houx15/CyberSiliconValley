from __future__ import annotations


async def ping(ctx: dict[str, object], value: str = "pong") -> dict[str, str]:
    _ = ctx
    return {"value": value}
