from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from contracts.auth import AuthUser
from contracts.memory import MemorySpaceRecord, MemorySpaceUpdateRequest
from csv_api.dependencies import get_current_user, get_db_session
from db.models.memory_space import MemorySpace


router = APIRouter(prefix="/api/v1/memory", tags=["memory"])


def _space_to_record(space: MemorySpace) -> MemorySpaceRecord:
    return MemorySpaceRecord(
        id=str(space.id),
        ownerId=str(space.owner_id),
        scopeType=space.scope_type,
        scopeRefId=space.scope_ref_id,
        entries=[
            {"key": e["key"], "value": e["value"], "updatedAt": e.get("updatedAt", "")}
            for e in (space.entries or [])
        ],
    )


def _find_or_create(session: Session, owner_id: UUID, scope_type: str, scope_ref_id: str | None) -> MemorySpace:
    stmt = select(MemorySpace).where(
        MemorySpace.owner_id == owner_id,
        MemorySpace.scope_type == scope_type,
    )
    if scope_ref_id:
        stmt = stmt.where(MemorySpace.scope_ref_id == scope_ref_id)
    else:
        stmt = stmt.where(MemorySpace.scope_ref_id.is_(None))

    # Use row lock to prevent race condition on concurrent find-or-create
    space = session.execute(stmt.limit(1).with_for_update()).scalar_one_or_none()
    if space is None:
        space = MemorySpace(
            owner_id=owner_id,
            scope_type=scope_type,
            scope_ref_id=scope_ref_id,
            entries=[],
        )
        session.add(space)
        session.flush()
        session.refresh(space)
    return space


@router.get("/{scope_type}", response_model=MemorySpaceRecord)
def get_memory_space(
    scope_type: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MemorySpaceRecord:
    space = _find_or_create(session, UUID(current_user.id), scope_type, None)
    return _space_to_record(space)


@router.get("/{scope_type}/{scope_ref_id}", response_model=MemorySpaceRecord)
def get_memory_space_with_ref(
    scope_type: str,
    scope_ref_id: str,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MemorySpaceRecord:
    space = _find_or_create(session, UUID(current_user.id), scope_type, scope_ref_id)
    return _space_to_record(space)


@router.post("/{scope_type}", response_model=MemorySpaceRecord)
def update_memory_space(
    scope_type: str,
    payload: MemorySpaceUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MemorySpaceRecord:
    space = _find_or_create(session, UUID(current_user.id), scope_type, None)
    space.entries = [e.model_dump(by_alias=True) for e in payload.entries]
    session.commit()
    session.refresh(space)
    return _space_to_record(space)


@router.post("/{scope_type}/{scope_ref_id}", response_model=MemorySpaceRecord)
def update_memory_space_with_ref(
    scope_type: str,
    scope_ref_id: str,
    payload: MemorySpaceUpdateRequest,
    session: Session = Depends(get_db_session),
    current_user: AuthUser = Depends(get_current_user),
) -> MemorySpaceRecord:
    space = _find_or_create(session, UUID(current_user.id), scope_type, scope_ref_id)
    space.entries = [e.model_dump(by_alias=True) for e in payload.entries]
    session.commit()
    session.refresh(space)
    return _space_to_record(space)
