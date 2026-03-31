from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from ai.providers.router import ProviderRouter
from ai.workflows.coach import run_coach_workflow
from contracts.auth import AuthUser
from contracts.coach import CoachMessage, CoachRequest, CoachStreamEvent
from db.repositories.chat import (
    get_chat_session_context,
    get_or_create_chat_session,
    save_chat_message,
    update_chat_session_context,
)
from db.repositories.matching import list_recent_matches_for_talent
from db.repositories.profiles import get_talent_profile_by_user_id


COACH_THREAD_CONTEXT_KEY = "coachThreads"


class MissingTalentProfileError(Exception):
    pass


@dataclass(slots=True)
class CoachService:
    session: object
    provider_router: ProviderRouter

    async def stream(self, user: AuthUser, payload: CoachRequest) -> list[CoachStreamEvent]:
        profile = get_talent_profile_by_user_id(self.session, UUID(user.id))
        if profile is None:
            raise MissingTalentProfileError("Talent profile not found")

        chat_session = get_or_create_chat_session(self.session, user_id=UUID(user.id), session_type="coach")
        context = get_chat_session_context(self.session, session_id=chat_session.id)
        coach_threads = dict(context.get(COACH_THREAD_CONTEXT_KEY) or {})
        mode_history = list(coach_threads.get(payload.mode) or [])

        normalized_messages = _normalize_messages(payload.messages)
        new_messages = _dedupe_transcript(mode_history, normalized_messages)
        thread_history = [*mode_history, *new_messages]

        update_chat_session_context(
            self.session,
            session_id=chat_session.id,
            context={
                **context,
                COACH_THREAD_CONTEXT_KEY: {
                    **coach_threads,
                    payload.mode: thread_history,
                },
            },
        )

        last_user_message = ""
        for message in reversed(normalized_messages):
            if message["role"] == "user":
                last_user_message = message["content"]
                break

        if last_user_message:
            save_chat_message(
                self.session,
                session_id=chat_session.id,
                role="user",
                content=last_user_message,
            )

        recent_matches = list_recent_matches_for_talent(self.session, talent_id=profile.id, limit=20)
        assistant_text, events = await run_coach_workflow(
            self.provider_router,
            mode=payload.mode,
            messages=thread_history,
            profile_json=_profile_json(profile),
            goals=str(profile.goals or {}),
            recent_matches_summary=_format_recent_match_summary(recent_matches),
            profile_name=profile.display_name or "Talent",
        )

        save_chat_message(
            self.session,
            session_id=chat_session.id,
            role="assistant",
            content=assistant_text,
        )
        update_chat_session_context(
            self.session,
            session_id=chat_session.id,
            context={
                **context,
                COACH_THREAD_CONTEXT_KEY: {
                    **coach_threads,
                    payload.mode: [*thread_history, {"role": "assistant", "content": assistant_text}],
                },
            },
        )
        return events


def _normalize_messages(messages: list[CoachMessage]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for message in messages:
        text_parts = [part.text or "" for part in message.parts or [] if part.type == "text"]
        text = "".join(text_parts).strip() or (message.content or "").strip()
        if text:
            normalized.append({"role": message.role, "content": text})
    return normalized


def _dedupe_transcript(existing: list[dict[str, str]], incoming: list[dict[str, str]]) -> list[dict[str, str]]:
    seen = {f"{message.get('role')}:{message.get('content')}" for message in existing}
    deduped: list[dict[str, str]] = []
    for message in incoming:
        key = f"{message.get('role')}:{message.get('content')}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(message)
    return deduped


def _profile_json(profile) -> str:
    return str(
        {
            "displayName": profile.display_name,
            "headline": profile.headline,
            "bio": profile.bio,
            "skills": profile.skills,
            "experience": profile.experience,
            "education": profile.education,
            "goals": profile.goals,
            "availability": profile.availability,
        }
    )


def _format_recent_match_summary(rows: list[dict[str, object]]) -> str:
    if not rows:
        return "No recent matches yet."

    top_matches = []
    for row in rows[:5]:
        top_matches.append(
            f"{row.get('job_title') or 'Untitled role'} at {row.get('company_name') or 'Unknown company'} ({round(float(row.get('score') or 0))}%)"
        )
    return ". ".join(
        [
            f"{sum(1 for row in rows if float(row.get('score') or 0) >= 80)} high matches (>80%)",
            f"Top matches: {', '.join(top_matches)}",
        ]
    )
