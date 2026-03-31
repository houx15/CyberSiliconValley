from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["talent", "enterprise"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AuthUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    email: str
    role: Role


class LoginResponse(BaseModel):
    user: AuthUser


class SessionResponse(BaseModel):
    user: AuthUser


class ErrorResponse(BaseModel):
    error: str
    message: str
