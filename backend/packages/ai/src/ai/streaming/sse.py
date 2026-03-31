from __future__ import annotations

from collections.abc import Iterable
from json import dumps
from typing import Any

from fastapi.responses import StreamingResponse
from pydantic import BaseModel


def event_to_sse_payload(event: BaseModel | dict[str, Any]) -> str:
    payload = event.model_dump() if isinstance(event, BaseModel) else event
    return f"event: {payload['event']}\ndata: {dumps(payload['data'])}\n\n"


def stream_events_as_sse(events: Iterable[BaseModel | dict[str, Any]]) -> StreamingResponse:
    return StreamingResponse((event_to_sse_payload(event) for event in events), media_type="text/event-stream")
