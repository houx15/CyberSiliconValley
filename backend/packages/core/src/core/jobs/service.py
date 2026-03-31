from __future__ import annotations

from uuid import UUID

from contracts.auth import AuthUser
from contracts.jobs import JobDetailMatch, JobListItem, JobRecord
from db.models.job import Job
from db.repositories.jobs import create_job, get_job_by_id_for_enterprise, list_jobs_for_enterprise
from db.repositories.matching import list_matches_for_job
from db.repositories.profiles import get_enterprise_profile_by_user_id


def _serialize_job(job: Job, *, match_count: int = 0, shortlisted_count: int = 0) -> JobListItem:
    return JobListItem(
        id=str(job.id),
        enterprise_id=str(job.enterprise_id),
        title=job.title,
        description=job.description,
        structured=job.structured,
        status=job.status,
        auto_match=job.auto_match,
        auto_prechat=job.auto_prechat,
        created_at=job.created_at,
        updated_at=job.updated_at,
        match_count=match_count,
        shortlisted_count=shortlisted_count,
    )


def _serialize_job_record(job: Job) -> JobRecord:
    return JobRecord(
        id=str(job.id),
        enterprise_id=str(job.enterprise_id),
        title=job.title,
        description=job.description,
        structured=job.structured,
        status=job.status,
        auto_match=job.auto_match,
        auto_prechat=job.auto_prechat,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def get_enterprise_profile(session, current_user: AuthUser):
    return get_enterprise_profile_by_user_id(session, UUID(current_user.id))


def list_enterprise_jobs(session, current_user: AuthUser) -> list[JobListItem] | None:
    profile = get_enterprise_profile(session, current_user)
    if profile is None:
        return None
    rows = list_jobs_for_enterprise(session, profile.id)
    return [
        _serialize_job(
            job,
            match_count=int(match_count or 0),
            shortlisted_count=int(shortlisted_count or 0),
        )
        for job, match_count, shortlisted_count in rows
    ]


def create_enterprise_job(session, current_user: AuthUser, payload) -> JobRecord | None:
    profile = get_enterprise_profile(session, current_user)
    if profile is None:
        return None
    job = create_job(
        session,
        enterprise_id=profile.id,
        title=payload.title,
        description=payload.description,
        structured=payload.structured.model_dump(by_alias=True),
        auto_match=payload.auto_match,
        auto_prechat=payload.auto_prechat,
    )
    return _serialize_job_record(job)


def get_enterprise_job_detail(session, current_user: AuthUser, job_id: str):
    profile = get_enterprise_profile(session, current_user)
    if profile is None:
        return None
    job = get_job_by_id_for_enterprise(session, UUID(job_id), profile.id)
    if job is None:
        return None
    matches = [JobDetailMatch(**dict(row)) for row in list_matches_for_job(session, job.id, profile.id)]
    return _serialize_job_record(job), matches
