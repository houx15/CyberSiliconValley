from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[3]
SRC_DIRS = [
    BACKEND_ROOT / "apps" / "mcp" / "src",
    BACKEND_ROOT / "packages" / "contracts" / "src",
]
for src_dir in SRC_DIRS:
    path = str(src_dir)
    if path not in sys.path:
        sys.path.insert(0, path)

from csv_mcp.main import *  # noqa: F401,F403


if __name__ == "__main__":
    raise SystemExit(main())
