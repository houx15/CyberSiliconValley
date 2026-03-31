from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from ai.providers.router import ProviderRouter
from ai.workflows.screening import run_screening_workflow
from contracts.auth import AuthUser
from contracts.screening import ScreeningRequest, ScreeningStreamEvent
from db.repositories.chat import get_or_create_chat_session, load_chat_history, save_chat_message
from db.repositories.jobs import list_jobs_for_enterprise
from db.repositories.profiles import get_enterprise_profile_by_user_id


@dataclass(slots=True)
class ScreeningService:
    session: object
    provider_router: ProviderRouter

    async def stream(self, user: AuthUser, payload: ScreeningRequest) -> list[ScreeningStreamEvent]:
        profile = get_enterprise_profile_by_user_id(self.session, UUID(user.id))
        company_name = profile.company_name if profile and profile.company_name else "Your Company"

        jobs = [
            {"id": str(job.id), "title": job.title}
            for job, _, _ in list_jobs_for_enterprise(self.session, profile.id)
        ] if profile is not None else []

        chat_session = get_or_create_chat_session(self.session, user_id=UUID(user.id), session_type="screening")
        history = [
            {"role": message.role, "content": message.content}
            for message in load_chat_history(self.session, session_id=chat_session.id)
        ]

        save_chat_message(
            self.session,
            session_id=chat_session.id,
            role="user",
            content=payload.message,
        )

        assistant_text, events = await run_screening_workflow(
            self.provider_router,
            message=payload.message,
            company_name=company_name,
            active_jobs=jobs,
            history=history,
        )

        save_chat_message(
            self.session,
            session_id=chat_session.id,
            role="assistant",
            content=assistant_text,
        )
        return events
