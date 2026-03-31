from __future__ import annotations

from typing import Any
from uuid import UUID

from contracts.seeking import SeekingReportData, TailoredResumePayload
from db.repositories.graph import get_enterprise_name, get_job
from db.repositories.seeking import (
    get_latest_seeking_report_for_talent,
    get_talent_profile_by_id,
    get_talent_profile_by_user_id,
)


def get_latest_report_by_user_id(session, user_id: str) -> tuple[str | None, SeekingReportData | None]:
    profile = get_talent_profile_by_user_id(session, UUID(user_id))
    if profile is None:
        return None, None
    report = get_latest_seeking_report_for_talent(session, profile.id)
    if report is None:
        return str(profile.id), None
    return str(profile.id), SeekingReportData(**report.report_data)


def _skill_lines(skills: list[dict[str, Any]]) -> str:
    return "\n".join(f"- {skill.get('name', 'Unknown')} ({skill.get('level', 'n/a')})" for skill in skills)


def _experience_lines(experience: list[dict[str, Any]]) -> str:
    chunks: list[str] = []
    for item in experience:
        role = item.get("role", "Role")
        company = item.get("company", "Company")
        duration = item.get("dateRange") or item.get("duration") or ""
        description = item.get("description", "")
        chunks.append(f"### {role} · {company}\n{duration}\n- {description}".strip())
    return "\n\n".join(chunks)


def build_fallback_resume(session, talent_id: str, job_id: str) -> TailoredResumePayload | None:
    profile = get_talent_profile_by_id(session, UUID(talent_id))
    if profile is None:
        return None

    job = get_job(session, UUID(job_id))
    if job is None:
        return None

    company_name = get_enterprise_name(session, job.enterprise_id)
    structured = job.structured or {}
    skills = list(profile.skills or [])
    experience = list(profile.experience or [])

    markdown = (
        f"# {profile.display_name or 'Candidate'}\n\n"
        f"## Summary\n"
        f"{profile.headline or 'Professional profile'} with hands-on experience relevant to {job.title} at {company_name}. "
        f"{profile.bio or ''}\n\n"
        f"## Core Skills\n{_skill_lines(skills)}\n\n"
        f"## Experience\n{_experience_lines(experience)}"
    ).strip()

    return TailoredResumePayload(
        markdown=markdown,
        talent_name=profile.display_name or "",
        job_title=job.title,
        company_name=company_name,
    )
