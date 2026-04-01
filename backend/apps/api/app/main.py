from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[3]
SRC_DIRS = [
    BACKEND_ROOT / "apps" / "api" / "src",
    BACKEND_ROOT / "packages" / "contracts" / "src",
    BACKEND_ROOT / "packages" / "core" / "src",
    BACKEND_ROOT / "packages" / "db" / "src",
    BACKEND_ROOT / "packages" / "ai" / "src",
    BACKEND_ROOT / "packages" / "redis_layer" / "src",
]
for src_dir in SRC_DIRS:
    path = str(src_dir)
    if path not in sys.path:
        sys.path.insert(0, path)

from csv_api.main import *  # noqa: F401,F403
