from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SRC_DIRS = [
    ROOT / "apps" / "api" / "src",
    ROOT / "apps" / "cli" / "src",
    ROOT / "packages" / "contracts" / "src",
    ROOT / "packages" / "core" / "src",
    ROOT / "packages" / "db" / "src",
    ROOT / "packages" / "ai" / "src",
    ROOT / "packages" / "redis_layer" / "src",
    ROOT / "apps" / "worker" / "src",
]

for src_dir in PACKAGE_SRC_DIRS:
    path = str(src_dir)
    if path not in sys.path:
        sys.path.insert(0, path)
