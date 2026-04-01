from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class UploadResult(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    file_id: str = Field(alias="fileId")
    filename: str
    url: str
    content_type: str = Field(alias="contentType")
    size: int
