from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.chat import SimpleChatRequest, StreamEvent
from contracts.profile import OnboardingResponse, OnboardingUpdateRequest
from ai.streaming.sse import stream_events_as_sse
from core.profiles.onboarding import apply_onboarding_update
from csv_api.dependencies import get_current_user, get_db_session
from db.repositories.chat import (
    get_or_create_chat_session,
    save_chat_message,
    update_chat_session_context,
)
from db.repositories.profiles import get_talent_profile_by_user_id


router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.patch("", response_model=OnboardingResponse)
def patch_onboarding(
    payload: OnboardingUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> OnboardingResponse:
    profile, onboarding_done = apply_onboarding_update(
        session,
        current_user,
        payload.profile,
        complete=payload.complete,
    )
    session.commit()
    return OnboardingResponse(profile=profile, onboarding_done=onboarding_done)


@router.post("/chat")
def onboarding_chat(
    payload: SimpleChatRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    if current_user.role != "talent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    user_id = UUID(current_user.id)
    profile = get_talent_profile_by_user_id(session, user_id)
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type="onboarding")
    save_chat_message(session, session_id=chat_session.id, role="user", content=payload.message)

    text = payload.message.strip()
    lower = text.lower()
    profile_updates: dict[str, object] = {}
    events: list[StreamEvent] = [StreamEvent(event="start", data={"surface": "onboarding"})]

    if profile is None or not profile.display_name:
        display_name = _display_name_from_email(current_user.email)
        profile_updates["display_name"] = display_name
        events.append(
            StreamEvent(
                event="tool",
                data={"name": "reveal_profile_field", "field": "displayName", "value": display_name},
            )
        )

    if any(keyword in lower for keyword in ("headline", "product", "engineer", "builder")):
        headline = _headline_from_message(text)
        profile_updates["headline"] = headline
        events.append(
            StreamEvent(
                event="tool",
                data={"name": "reveal_profile_field", "field": "headline", "value": headline},
            )
        )

    extracted_skills = _extract_skills(lower)
    existing_skills = list((profile.skills if profile is not None else None) or [])
    new_skills = [skill for skill in extracted_skills if skill["name"].lower() not in {row["name"].lower() for row in existing_skills}]
    if new_skills:
        profile_updates["skills"] = [*existing_skills, *new_skills]
        for skill in new_skills:
            events.append(
                StreamEvent(
                    event="tool",
                    data={
                        "name": "add_skill_tag",
                        "skillName": skill["name"],
                        "level": skill["level"],
                        "category": skill["category"],
                    },
                )
            )

    if any(keyword in lower for keyword in ("experience", "worked", "built", "shipped")):
        experience_item = {
            "role": "AI Builder",
            "company": "Recent Team",
            "duration": "Recent",
            "description": text,
        }
        existing_experience = list((profile.experience if profile is not None else None) or [])
        profile_updates["experience"] = [*existing_experience, experience_item]
        events.append(
            StreamEvent(
                event="tool",
                data={"name": "reveal_profile_field", "field": "experience", "value": experience_item},
            )
        )

    if any(keyword in lower for keyword in ("goal", "looking for", "target", "want")):
        goals = {"targetRoles": [_headline_from_message(text)]}
        profile_updates["goals"] = goals
        events.append(
            StreamEvent(event="tool", data={"name": "reveal_profile_field", "field": "goals", "value": goals})
        )

    complete = any(keyword in lower for keyword in ("wrap up", "done", "complete", "that covers"))
    profile_payload, onboarding_done = apply_onboarding_update(
        session,
        current_user,
        profile_updates,
        complete=complete,
    )
    update_chat_session_context(
        session,
        session_id=chat_session.id,
        context={"lastProfile": profile_payload, "onboardingDone": onboarding_done},
    )

    assistant_text = _build_onboarding_reply(
        message=text,
        profile_payload=profile_payload,
        onboarding_done=onboarding_done,
        new_skill_names=[skill["name"] for skill in new_skills],
    )
    save_chat_message(session, session_id=chat_session.id, role="assistant", content=assistant_text)
    session.commit()

    events.append(StreamEvent(event="text", data={"delta": assistant_text}))
    if onboarding_done:
        events.append(StreamEvent(event="tool", data={"name": "complete_onboarding"}))
    events.append(StreamEvent(event="done", data={"message": assistant_text}))
    return stream_events_as_sse(events)


def _display_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0].replace(".", " ").replace("-", " ")
    return " ".join(part.capitalize() for part in local.split() if part) or "Talent"


def _headline_from_message(message: str) -> str:
    lower = message.lower()
    if "product" in lower:
        return "AI Product Builder"
    if "frontend" in lower:
        return "Frontend Engineer for AI Products"
    if "rag" in lower:
        return "RAG Engineer"
    if "machine learning" in lower or "ml" in lower:
        return "Machine Learning Engineer"
    return "AI Talent"


def _extract_skills(message: str) -> list[dict[str, str]]:
    catalog = {
        "python": {"name": "Python", "level": "advanced", "category": "engineering"},
        "typescript": {"name": "TypeScript", "level": "advanced", "category": "engineering"},
        "rag": {"name": "RAG", "level": "advanced", "category": "ai"},
        "llm": {"name": "LLM Applications", "level": "intermediate", "category": "ai"},
        "evaluation": {"name": "Evaluation Design", "level": "intermediate", "category": "ai"},
        "sql": {"name": "SQL", "level": "intermediate", "category": "data"},
    }
    return [payload for key, payload in catalog.items() if key in message]


def _build_onboarding_reply(
    *,
    message: str,
    profile_payload: dict[str, object],
    onboarding_done: bool,
    new_skill_names: list[str],
) -> str:
    if onboarding_done:
        return "Your talent profile is ready. I captured the essentials and marked onboarding complete."

    if new_skill_names:
        return (
            "I added "
            + ", ".join(new_skill_names)
            + " to your profile. Share a recent project or the roles you want next, and I will keep shaping your portrait."
        )

    if profile_payload.get("headline"):
        return "I started your profile draft. Tell me about a project you shipped or the kind of team you want next."

    return f"I have your context from: {message}. Tell me about your strongest skills or recent work, and I will map them into your profile."
