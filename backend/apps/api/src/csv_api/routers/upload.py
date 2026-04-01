from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.responses import JSONResponse

from contracts.auth import AuthUser
from contracts.upload import UploadResult
from csv_api.dependencies import get_current_user


router = APIRouter(prefix="/api/v1/upload", tags=["upload"])

UPLOAD_DIR = Path(os.getenv("CSV_UPLOAD_DIR", "/tmp/csv-uploads"))


def _save_file(file: UploadFile, subdir: str) -> UploadResult:
    dest = UPLOAD_DIR / subdir
    dest.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = Path(file.filename or "file").suffix
    filename = f"{file_id}{ext}"
    filepath = dest / filename

    content = file.file.read()
    filepath.write_bytes(content)

    return UploadResult(
        fileId=file_id,
        filename=file.filename or filename,
        url=f"/uploads/{subdir}/{filename}",
        contentType=file.content_type or "application/octet-stream",
        size=len(content),
    )


@router.post("/resume", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
def upload_resume(
    file: UploadFile,
    current_user: AuthUser = Depends(get_current_user),
) -> UploadResult | JSONResponse:
    if current_user.role != "talent":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})
    return _save_file(file, "resumes")


@router.post("/company-doc", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
def upload_company_doc(
    file: UploadFile,
    current_user: AuthUser = Depends(get_current_user),
) -> UploadResult | JSONResponse:
    if current_user.role != "enterprise":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})
    return _save_file(file, "company-docs")
