from __future__ import annotations

from dataclasses import dataclass

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from db.session import get_database_url, normalize_database_url


@dataclass(frozen=True)
class BootstrapConfig:
    admin_dsn: str
    target_dsn: str
    role_name: str
    role_password: str
    database_name: str
    create_extension: bool


def _as_psycopg_dsn(database_url: str) -> str:
    url = make_url(normalize_database_url(database_url))
    drivername = url.drivername
    if drivername.startswith("postgresql+"):
        url = url.set(drivername="postgresql")
    return url.render_as_string(hide_password=False)


def build_bootstrap_config(
    database_url: str,
    *,
    admin_url: str | None = None,
    create_extension: bool = True,
) -> BootstrapConfig:
    target_url = make_url(normalize_database_url(database_url))
    if not target_url.username:
        raise ValueError("DATABASE_URL must include a username for init-db")
    if target_url.password is None:
        raise ValueError("DATABASE_URL must include a password for init-db")
    if not target_url.database:
        raise ValueError("DATABASE_URL must include a database name for init-db")

    resolved_admin_url = admin_url or target_url.set(database="postgres").render_as_string(hide_password=False)

    return BootstrapConfig(
        admin_dsn=_as_psycopg_dsn(resolved_admin_url),
        target_dsn=_as_psycopg_dsn(database_url),
        role_name=target_url.username,
        role_password=str(target_url.password),
        database_name=target_url.database,
        create_extension=create_extension,
    )


def run_init_db_command(*, admin_url: str | None, create_extension: bool) -> int:
    config = build_bootstrap_config(
        get_database_url(),
        admin_url=admin_url,
        create_extension=create_extension,
    )

    role_created = False
    database_created = False

    with psycopg.connect(config.admin_dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (config.role_name,))
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(config.role_name)),
                    (config.role_password,),
                )
                role_created = True
            else:
                cur.execute(
                    sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(config.role_name)),
                    (config.role_password,),
                )

            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (config.database_name,))
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(config.database_name),
                        sql.Identifier(config.role_name),
                    )
                )
                database_created = True

    extension_enabled = False
    if config.create_extension:
        with psycopg.connect(config.target_dsn, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        extension_enabled = True

    print(
        "Init DB complete:",
        {
            "role": config.role_name,
            "role_created": role_created,
            "database": config.database_name,
            "database_created": database_created,
            "vector_enabled": extension_enabled,
        },
    )
    return 0
