from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScreeningRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1)


class ScreeningStreamEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str
    data: dict[str, Any]
