from __future__ import annotations

from dataclasses import dataclass

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from contracts.auth import AuthUser, Role
from db.models.user import User
from db.repositories.auth import get_user_by_email

AUTH_COOKIE_NAME = "auth-token"
AUTH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
AUTH_TOKEN_SALT = "csv-auth-token"


class InvalidCredentialsError(Exception):
    pass


class InvalidSessionError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class AuthService:
    secret: str
    max_age_seconds: int = AUTH_MAX_AGE_SECONDS

    @property
    def cookie_name(self) -> str:
        return AUTH_COOKIE_NAME

    def authenticate(self, session: Session, email: str, password: str) -> AuthUser:
        user = get_user_by_email(session, email)
        if user is None or not self.verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid email or password")
        return self.to_auth_user(user)

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False

    def issue_token(self, user: AuthUser) -> str:
        serializer = self._serializer()
        return serializer.dumps(
            {
                "user_id": user.id,
                "email": user.email,
                "role": user.role,
            }
        )

    def read_token(self, token: str) -> AuthUser:
        serializer = self._serializer()
        try:
            payload = serializer.loads(token, max_age=self.max_age_seconds)
        except (BadSignature, SignatureExpired) as exc:
            raise InvalidSessionError("Invalid authentication token") from exc
        return self.auth_user_from_payload(payload)

    def auth_user_from_payload(self, payload: dict[str, Any]) -> AuthUser:
        return AuthUser(
            id=str(payload["user_id"]),
            email=str(payload["email"]),
            role=payload["role"],
        )

    def to_auth_user(self, user: User) -> AuthUser:
        return AuthUser(id=str(user.id), email=user.email, role=user.role)

    def _serializer(self) -> URLSafeTimedSerializer:
        return URLSafeTimedSerializer(self.secret, salt=AUTH_TOKEN_SALT)
