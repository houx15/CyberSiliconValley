from __future__ import annotations

import os
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from apps._runtime_env import load_backend_env


def test_load_backend_env_sets_missing_values_only(tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "DATABASE_URL=postgresql+psycopg://test_user:test_password@db.example.invalid:5432/test_db",
                "REDIS_URL=redis://redis.example.invalid:6379/9",
            ]
        )
    )

    original_database_url = os.environ.get("DATABASE_URL")
    original_redis_url = os.environ.get("REDIS_URL")

    try:
        os.environ.pop("DATABASE_URL", None)
        os.environ["REDIS_URL"] = "redis://override:6379/0"

        load_backend_env(env_file)

        assert os.environ["DATABASE_URL"] == "postgresql+psycopg://test_user:test_password@db.example.invalid:5432/test_db"
        assert os.environ["REDIS_URL"] == "redis://override:6379/0"
    finally:
        if original_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = original_database_url

        if original_redis_url is None:
            os.environ.pop("REDIS_URL", None)
        else:
            os.environ["REDIS_URL"] = original_redis_url
