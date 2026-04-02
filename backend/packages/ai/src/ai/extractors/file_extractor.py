"""Extract text from files (PDF, DOCX, PPTX, images, etc.) using markitdown."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from markitdown import MarkItDown

logger = logging.getLogger(__name__)

_converter = MarkItDown()


def extract_text_from_file(file_path: str | Path) -> str:
    """Convert a file to markdown text.

    Supports PDF, DOCX, PPTX, images, and other formats handled by markitdown.
    Returns an empty string on failure.
    """
    try:
        result = _converter.convert(str(file_path))
        return result.text_content or ""
    except Exception:
        logger.exception("Failed to extract text from %s", file_path)
        return ""


def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Write bytes to a temp file, then extract text.

    The temp file preserves the original filename suffix so markitdown can
    detect the file type.
    """
    suffix = Path(filename).suffix or ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(content)
            tmp.flush()
            return extract_text_from_file(tmp.name)
    except Exception:
        logger.exception("Failed to extract text from bytes (filename=%s)", filename)
        return ""
