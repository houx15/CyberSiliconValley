from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.inbox import InboxDetailResponse, InboxListPayload, InboxListResponse, InboxMarkReadResponse
from core.inbox.service import get_inbox_item, list_inbox_items, mark_inbox_item_read
from csv_api.dependencies import get_current_user, get_db_session


router = APIRouter(prefix="/api/v1/inbox", tags=["inbox"])


@router.get("", response_model=InboxListResponse)
def read_inbox(
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> InboxListResponse | JSONResponse:
    filter_value = request.query_params.get("filter", "all")
    if filter_value not in {"all", "invites", "prechats", "matches", "system"}:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "VALIDATION_ERROR"})

    items, unread_count = list_inbox_items(session, current_user.id, filter_value)
    return InboxListResponse(data=InboxListPayload(items=items, unread_count=unread_count))


@router.get("/{item_id}", response_model=InboxDetailResponse)
def read_inbox_item(
    item_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> InboxDetailResponse | JSONResponse:
    item = get_inbox_item(session, item_id, current_user.id)
    if item is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})
    return InboxDetailResponse(data=item)


@router.patch("/{item_id}", response_model=InboxMarkReadResponse)
def patch_inbox_item(
    item_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> InboxMarkReadResponse | JSONResponse:
    updated = mark_inbox_item_read(session, item_id, current_user.id)
    if not updated:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "NOT_FOUND"})
    session.commit()
    return InboxMarkReadResponse(success=True)
