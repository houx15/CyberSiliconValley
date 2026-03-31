from __future__ import annotations

from typing import Any
from uuid import UUID

from contracts.graph import ClusterJob, GraphDataResponse, GraphEdgePayload, GraphNodePayload, JobDetail
from db.repositories.graph import (
    get_enterprise_name,
    get_job,
    get_match_for_talent_and_job,
    list_keyword_edges,
    list_keyword_nodes,
    list_open_jobs,
)


def _job_matches_keyword(job_structured: dict[str, Any], keyword: str) -> bool:
    normalized = keyword.strip().lower()
    skills = job_structured.get("skills") or []
    return any(str(skill.get("name", "")).strip().lower() == normalized for skill in skills)


def _format_budget_range(structured: dict[str, Any]) -> str:
    if structured.get("budgetRange"):
        return str(structured["budgetRange"])
    budget = structured.get("budget") or {}
    lower = budget.get("min")
    upper = budget.get("max")
    currency = budget.get("currency", "")
    if lower is None and upper is None:
        return ""
    if lower is not None and upper is not None:
        return f"{currency} {lower}-{upper}".strip()
    return f"{currency} {lower or upper}".strip()


def _format_deliverables(deliverables: Any) -> str:
    if isinstance(deliverables, list):
        return ", ".join(str(item) for item in deliverables)
    return str(deliverables or "")


def get_graph_data(session) -> GraphDataResponse:
    nodes = [
        GraphNodePayload(
            id=str(node.id),
            keyword=node.keyword,
            job_count=node.job_count,
            trending=bool(node.trending),
        )
        for node in list_keyword_nodes(session)
    ]
    edges = [
        GraphEdgePayload(
            id=str(edge.id),
            source_id=str(edge.source_id),
            target_id=str(edge.target_id),
            weight=edge.weight,
        )
        for edge in list_keyword_edges(session)
    ]
    return GraphDataResponse(nodes=nodes, edges=edges)


def get_jobs_for_keyword(session, keyword: str, talent_id: str | None = None) -> list[ClusterJob]:
    talent_uuid = UUID(talent_id) if talent_id else None
    results: list[ClusterJob] = []
    for job in list_open_jobs(session):
        structured = job.structured or {}
        if not _job_matches_keyword(structured, keyword):
            continue

        match = get_match_for_talent_and_job(session, talent_uuid, job.id) if talent_uuid else None
        results.append(
            ClusterJob(
                id=str(job.id),
                title=job.title,
                company_name=get_enterprise_name(session, job.enterprise_id),
                location=str(structured.get("location") or "Remote"),
                work_mode=str(structured.get("workMode") or "remote"),
                match_score=match.score if match else None,
                skills=list(structured.get("skills") or []),
            )
        )
    return results


def get_job_detail(session, job_id: str, talent_id: str | None = None) -> JobDetail | None:
    job = get_job(session, UUID(job_id))
    if job is None:
        return None

    structured = job.structured or {}
    match = get_match_for_talent_and_job(session, UUID(talent_id), job.id) if talent_id else None
    breakdown = match.breakdown if match else None
    normalized_breakdown = None
    if isinstance(breakdown, dict):
        normalized_breakdown = {
            str(key): float(value)
            for key, value in breakdown.items()
            if isinstance(value, (int, float))
        }

    return JobDetail(
        id=str(job.id),
        title=job.title,
        description=job.description or "",
        company_name=get_enterprise_name(session, job.enterprise_id),
        location=str(structured.get("location") or "Remote"),
        work_mode=str(structured.get("workMode") or "remote"),
        seniority=str(structured.get("seniority") or ""),
        budget_range=_format_budget_range(structured),
        timeline=str(structured.get("timeline") or ""),
        deliverables=_format_deliverables(structured.get("deliverables")),
        match_score=match.score if match else None,
        match_breakdown=normalized_breakdown,
        ai_reasoning=match.ai_reasoning if match else None,
        skills=list(structured.get("skills") or []),
    )
