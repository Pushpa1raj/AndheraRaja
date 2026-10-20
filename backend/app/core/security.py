"""Supabase access-token validation and API authorization dependencies."""

from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus

bearer_scheme = HTTPBearer(auto_error=False)
_JWKS_TTL_SECONDS = 60 * 60
_jwks_cache: dict[str, Any] = {"value": None, "expires_at": 0.0}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None
    role: UserRole
    status: UserStatus


def _credentials_error(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _fetch_jwks() -> dict[str, Any]:
    now = time.monotonic()
    cached = _jwks_cache["value"]
    if cached and now < _jwks_cache["expires_at"]:
        return cached
    if not settings.resolved_jwks_url:
        raise _credentials_error("Supabase JWT verification is not configured")
    try:
        response = httpx.get(settings.resolved_jwks_url, timeout=5.0)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        if cached:
            return cached
        raise HTTPException(status_code=503, detail="Authentication key service is unavailable") from exc
    _jwks_cache.update(value=payload, expires_at=now + _JWKS_TTL_SECONDS)
    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    """Validate signature, issuer, audience, expiry, and subject.

    A symmetric development fallback exists solely for local Supabase versions
    that do not expose JWKS. Production never accepts this path.
    """
    try:
        header = jwt.get_unverified_header(token)
        if settings.resolved_jwks_url:
            jwks = _fetch_jwks()
            kid = header.get("kid")
            key = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)
            if key is None:
                _jwks_cache.update(value=None, expires_at=0.0)
                jwks = _fetch_jwks()
                key = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)
            if key is None:
                raise _credentials_error("Signing key is unknown")
            options = {"verify_aud": bool(settings.supabase_jwt_audience)}
            payload = jwt.decode(
                token,
                key,
                algorithms=[header.get("alg", "RS256")],
                audience=settings.supabase_jwt_audience or None,
                issuer=settings.resolved_jwt_issuer or None,
                options=options,
            )
        elif not settings.is_production and settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience or None,
                options={"verify_aud": bool(settings.supabase_jwt_audience)},
            )
        else:
            raise _credentials_error("Supabase JWT verification is not configured")
    except HTTPException:
        raise
    except JWTError as exc:
        raise _credentials_error() from exc

    if not payload.get("sub"):
        raise _credentials_error()
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _credentials_error("Missing bearer token")

    payload = decode_access_token(credentials.credentials)
    try:
        user_id = UUID(str(payload["sub"]))
    except ValueError as exc:
        raise _credentials_error("Invalid token subject") from exc

    user = db.get(User, user_id)
    if user is None:
        # Auto-provision profile from Supabase authenticated token
        email = str(payload.get("email") or f"user_{str(user_id)[:8]}@andheraraja.com")
        user_meta = payload.get("user_metadata") or {}
        display_name = user_meta.get("display_name") or user_meta.get("full_name") or email.split("@")[0]
        # First user or pushpraj admin email can be given ADMIN role
        role = UserRole.ADMIN if ("pushpraj" in email.lower() or user_meta.get("role") == "admin") else UserRole.USER
        user = User(
            id=user_id,
            email=email,
            display_name=display_name[:60],
            role=role,
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        # Initialize virtual credit account with 1,000 starting credits
        from app.models.credit import CreditAccount
        credit_account = db.get(CreditAccount, user_id)
        if credit_account is None:
            credit_account = CreditAccount(
                user_id=user_id,
                balance=1000,
                version=1,
            )
            db.add(credit_account)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.get(User, user_id)
            if user is None:
                raise HTTPException(status_code=404, detail="Profile not found")

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="This account is not permitted to perform that action")
    return AuthenticatedUser(id=user.id, email=user.email, role=user.role, status=user.status)


async def get_current_admin_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Administrator permission is required")
    return current_user
