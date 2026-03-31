from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ai.streaming.sse import stream_events_as_sse
from contracts.auth import AuthUser
from contracts.chat import SimpleChatRequest, StreamEvent
from core.profiles.onboarding import apply_onboarding_update
from csv_api.dependencies import get_current_user, get_db_session
from db.repositories.chat import (
    get_or_create_chat_session,
    save_chat_message,
    update_chat_session_context,
)
from db.repositories.jobs import create_job
from db.repositories.profiles import get_enterprise_profile_by_user_id


router = APIRouter(prefix="/api/v1/enterprise/onboarding", tags=["enterprise-onboarding"])


@router.post("/chat")
def enterprise_onboarding_chat(
    payload: SimpleChatRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    if current_user.role != "enterprise":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_id = UUID(current_user.id)
    text = payload.message.strip()
    lower = text.lower()
    profile = get_enterprise_profile_by_user_id(session, user_id)
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type="enterprise_onboarding")
    save_chat_message(session, session_id=chat_session.id, role="user", content=text)

    events: list[StreamEvent] = [StreamEvent(event="start", data={"surface": "enterprise_onboarding"})]
    profile_updates: dict[str, object] = {}

    if profile is None or not profile.company_name:
        company_name = _company_name_from_email(current_user.email)
        profile_updates.update(
            {
                "company_name": company_name,
                "industry": "AI Software",
                "company_size": "11-50",
                "description": text if len(text) > 20 else f"{company_name} is building practical AI products.",
                "ai_maturity": "growing",
            }
        )
        events.append(
            StreamEvent(
                event="tool",
                data={
                    "name": "set_company_profile",
                    "companyName": company_name,
                    "industry": "AI Software",
                    "companySize": "11-50",
                    "description": profile_updates["description"],
                    "aiMaturity": "growing",
                },
            )
        )

    complete = any(keyword in lower for keyword in ("wrap up", "done", "complete", "dashboard"))
    profile_payload, onboarding_done = apply_onboarding_update(
        session,
        current_user,
        profile_updates,
        complete=complete,
    )

    enterprise_profile = get_enterprise_profile_by_user_id(session, user_id)
    created_job_id = None
    created_job_title = None
    should_create_job = enterprise_profile is not None and (
        any(keyword in lower for keyword in ("hire", "role", "job", "engineer", "candidate"))
        or profile is None
    )
    if should_create_job:
        title = _job_title_from_message(text)
        job = create_job(
            session,
            enterprise_id=enterprise_profile.id,
            title=title,
            description=text,
            structured={
                "skills": _enterprise_skills(lower),
                "seniority": "Mid",
                "timeline": "Open to discuss",
                "deliverables": ["Ship a production-ready AI workflow"],
                "budget": {"currency": "USD"},
                "workMode": "remote",
            },
            auto_match=True,
            auto_prechat=False,
        )
        created_job_id = str(job.id)
        created_job_title = title
        events.append(
            StreamEvent(
                event="tool",
                data={"name": "create_job", "title": title, "jobId": created_job_id},
            )
        )

    update_chat_session_context(
        session,
        session_id=chat_session.id,
        context={
            "profile": profile_payload,
            "jobId": created_job_id,
            "jobTitle": created_job_title,
            "onboardingDone": onboarding_done,
        },
    )

    assistant_text = _build_enterprise_reply(
        company_name=str(profile_payload.get("company_name") or "your company"),
        job_title=created_job_title,
        onboarding_done=onboarding_done,
    )
    save_chat_message(session, session_id=chat_session.id, role="assistant", content=assistant_text)
    session.commit()

    if onboarding_done:
        events.append(StreamEvent(event="tool", data={"name": "complete_onboarding"}))
    events.append(StreamEvent(event="text", data={"delta": assistant_text}))
    events.append(StreamEvent(event="done", data={"message": assistant_text}))
    return stream_events_as_sse(events)


def _company_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0].replace(".", " ").replace("-", " ").title()
    return f"{local} Labs".strip() if local else "CSV Enterprise"


def _job_title_from_message(message: str) -> str:
    lower = message.lower()
    if "rag" in lower:
        return "RAG Engineer"
    if "frontend" in lower:
        return "Frontend Engineer"
    if "data" in lower:
        return "Data Engineer"
    return "AI Engineer"


def _enterprise_skills(message: str) -> list[dict[str, object]]:
    skills: list[dict[str, object]] = []
    for name in ("Python", "RAG", "LLM Applications", "TypeScript", "SQL"):
        if name.lower() in message:
            skills.append({"name": name, "level": "advanced", "required": True})
    return skills or [{"name": "Python", "level": "advanced", "required": True}]


def _build_enterprise_reply(*, company_name: str, job_title: str | None, onboarding_done: bool) -> str:
    if onboarding_done:
        return f"{company_name} is ready. I marked onboarding complete and your dashboard can take over from here."
    if job_title:
        return f"I captured your company profile and drafted a {job_title} role. Review the draft, then we can move into matching."
    return f"I captured the company basics for {company_name}. Tell me about the first role you need to hire."
