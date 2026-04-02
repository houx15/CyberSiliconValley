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
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
RESUME_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".rtf"}
COMPANY_DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".rtf", ".pptx", ".xlsx", ".csv"}


def _save_file(file: UploadFile, subdir: str, allowed_extensions: set[str]) -> UploadResult | JSONResponse:
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in allowed_extensions:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": f"File type '{ext}' not allowed. Accepted: {', '.join(sorted(allowed_extensions))}"},
        )

    dest = UPLOAD_DIR / subdir
    dest.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = dest / filename

    # Read in bounded chunks to enforce size limit
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = file.file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit"},
            )
        chunks.append(chunk)

    content = b"".join(chunks)
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
    return _save_file(file, "resumes", RESUME_EXTENSIONS)


@router.post("/company-doc", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
def upload_company_doc(
    file: UploadFile,
    current_user: AuthUser = Depends(get_current_user),
) -> UploadResult | JSONResponse:
    if current_user.role != "enterprise":
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"error": "FORBIDDEN"})
    return _save_file(file, "company-docs", COMPANY_DOC_EXTENSIONS)
