FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/pyproject.toml
COPY apps/api/src apps/api/src
COPY apps/cli/pyproject.toml apps/cli/pyproject.toml
COPY apps/cli/src apps/cli/src
COPY apps/mcp/pyproject.toml apps/mcp/pyproject.toml
COPY apps/mcp/src apps/mcp/src
COPY apps/worker/pyproject.toml apps/worker/pyproject.toml
COPY apps/worker/src apps/worker/src
COPY packages/ai/pyproject.toml packages/ai/pyproject.toml
COPY packages/ai/src packages/ai/src
COPY packages/contracts/pyproject.toml packages/contracts/pyproject.toml
COPY packages/contracts/src packages/contracts/src
COPY packages/core/pyproject.toml packages/core/pyproject.toml
COPY packages/core/src packages/core/src
COPY packages/db/pyproject.toml packages/db/pyproject.toml
COPY packages/db/src packages/db/src
COPY packages/redis_layer/pyproject.toml packages/redis_layer/pyproject.toml
COPY packages/redis_layer/src packages/redis_layer/src
COPY apps/worker/app app
COPY apps/worker/src apps/worker/src

RUN uv sync --frozen --no-dev --package csv-worker

CMD ["sh", "-lc", "uv run python -m apps.worker.app.main"]
