from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "csv-api"
    app_version: str = "0.1.0"
    app_env: str = "development"
    app_secret: str = "change-me"
    cookie_domain: str = "localhost"
    frontend_origin: str = "http://localhost:3000"
    database_url: str = ""
    redis_url: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        app_secret=os.getenv("APP_SECRET", "change-me"),
        cookie_domain=os.getenv("COOKIE_DOMAIN", "localhost"),
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        database_url=os.getenv("DATABASE_URL", ""),
        redis_url=os.getenv("REDIS_URL", ""),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_base_url=os.getenv("OPENAI_BASE_URL", ""),
    )
