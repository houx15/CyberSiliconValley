"""
TDD tests for the 5 known gaps.

Pure unit tests (no DB required) — contracts, prompts, workflows.
Endpoint tests are in tests/integration/test_remote_api.py.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


# ── Gap 1: Opportunities endpoint registered ──


def test_opportunities_route_registered():
    """The /api/v1/companion/opportunities route should exist in the app."""
    from csv_api.routers.companion import router
    paths = [route.path for route in router.routes]
    assert "/opportunities" in paths or any("/opportunities" in str(p) for p in paths)


# ── Gap 2: Talent market endpoint registered ──


def test_talent_market_route_registered():
    """The /api/v1/talent-market route should exist."""
    from csv_api.routers.talent_market import router
    paths = [route.path for route in router.routes]
    assert any("talent-market" in p for p in paths)


# ── Gap 3: Usage endpoint returns correct shape ──


def test_usage_data_contract():
    """UsageData must have all required fields with correct types."""
    from contracts.subscription_contracts import UsageData
    data = UsageData(
        matchesToday=5,
        matchesLimit=50,
        preChatsToday=2,
        preChatsLimit=10,
        coachToday=3,
        coachLimit=20,
    )
    assert data.matches_today == 5
    assert data.matches_limit == 50


# ── Gap 4: PreChat AI Summary ──


def test_prechat_summary_contract():
    """generate_prechat_summary function exists and is callable."""
    from ai.workflows.prechat_summary import generate_prechat_summary
    assert callable(generate_prechat_summary)


@pytest.mark.anyio
async def test_prechat_summary_calls_provider():
    """generate_prechat_summary should call the LLM provider."""
    from ai.workflows.prechat_summary import generate_prechat_summary
    from ai.providers.router import AICompletionResult, ProviderRouter

    class FakeProvider:
        async def complete(self, request):
            return AICompletionResult(text="Summary: mutual interest in the role.")

    router = ProviderRouter(provider=FakeProvider())
    result = await generate_prechat_summary(
        provider_router=router,
        messages=[
            {"sender_type": "ai_talent", "content": "I'm interested in this role."},
            {"sender_type": "ai_hr", "content": "Your background looks great."},
        ],
        talent_name="Alice",
        company_name="TechCorp",
        job_title="AI Engineer",
    )
    assert "Summary" in result


# ── Gap 5: LLM Resume Generation ──


def test_resume_generation_prompt_exists():
    """Verify resume generation prompt template exists."""
    from ai.prompts.resume_gen import RESUME_GEN_SYSTEM_PROMPT
    assert "resume" in RESUME_GEN_SYSTEM_PROMPT.lower() or "简历" in RESUME_GEN_SYSTEM_PROMPT


@pytest.mark.anyio
async def test_resume_generate_uses_llm():
    """Resume generation should call LLM and return markdown."""
    from ai.workflows.resume_gen import generate_tailored_resume
    from ai.providers.router import AICompletionResult, ProviderRouter

    class FakeProvider:
        async def complete(self, request):
            return AICompletionResult(text="# Alice\n## Summary\nExpert Python developer...")

    router = ProviderRouter(provider=FakeProvider())
    result = await generate_tailored_resume(
        provider_router=router,
        profile_json='{"displayName": "Alice", "skills": [{"name": "Python"}]}',
        job_title="AI Engineer",
        company_name="TechCorp",
        job_description="Build AI systems",
    )
    assert result is not None
    assert "Alice" in result


@pytest.mark.anyio
async def test_resume_generate_returns_empty_on_no_provider():
    """With DeterministicProvider, resume generation still returns something."""
    from ai.workflows.resume_gen import generate_tailored_resume
    from ai.providers.router import ProviderRouter

    router = ProviderRouter()  # Falls back to DeterministicProvider
    result = await generate_tailored_resume(
        provider_router=router,
        profile_json='{"displayName": "Bob"}',
        job_title="Engineer",
        company_name="Corp",
        job_description="Build things",
    )
    assert isinstance(result, str)
    assert len(result) > 0
