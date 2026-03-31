from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ai.streaming.sse import stream_events_as_sse
from contracts.auth import AuthUser
from contracts.chat import CompanionRequest, StreamEvent
from csv_api.dependencies import get_current_user, get_db_session
from db.repositories.chat import get_or_create_chat_session, save_chat_message


router = APIRouter(prefix="/api/v1/companion", tags=["companion"])


@router.post("")
def companion_chat(
    payload: CompanionRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
):
    user_id = UUID(current_user.id)
    session_type = payload.session_type if payload.session_type in {"general", "home", "coach"} else "general"
    chat_session = get_or_create_chat_session(session, user_id=user_id, session_type=f"companion:{session_type}")

    latest_user_message = ""
    for message in reversed(payload.messages):
        text = "".join(part.text or "" for part in message.parts or [] if part.type == "text").strip() or (message.content or "").strip()
        if message.role == "user" and text:
            latest_user_message = text
            break

    if latest_user_message:
        save_chat_message(session, session_id=chat_session.id, role="user", content=latest_user_message)

    assistant_text = _build_companion_reply(session_type=session_type, message=latest_user_message or "what to do next")
    save_chat_message(session, session_id=chat_session.id, role="assistant", content=assistant_text)
    session.commit()

    return stream_events_as_sse(
        [
            StreamEvent(event="start", data={"surface": "companion", "sessionType": session_type}),
            StreamEvent(event="text", data={"delta": assistant_text}),
            StreamEvent(event="done", data={"message": assistant_text}),
        ]
    )


def _build_companion_reply(*, session_type: str, message: str) -> str:
    if session_type == "coach":
        return f"Use the coach tab to turn '{message}' into a sharper positioning story, then test it against your best matches."
    if session_type == "home":
        return f"From home, start with '{message}', then review your portrait and matches for the strongest next move."
    return f"Start with the highest-signal next step for '{message}', then use inbox, seeking, and coach to tighten the loop."

