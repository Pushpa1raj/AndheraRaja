from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

from fastapi import Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Page:
    limit: int
    offset: int


def pagination(page: int = 1, page_size: int = 20) -> Page:
    if page < 1 or not 1 <= page_size <= 100:
        raise HTTPException(status_code=422, detail="page must be positive and page_size must be between 1 and 100")
    return Page(limit=page_size, offset=(page - 1) * page_size)


def require_idempotency_key(idempotency_key: str | None = Header(default=None)) -> str:
    if idempotency_key is None or not 16 <= len(idempotency_key) <= 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A 16–255 character Idempotency-Key header is required",
        )
    return idempotency_key


def request_hash(payload: object) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def claim_idempotency_key(
    db: Session,
    *,
    actor_id: UUID,
    operation: str,
    key: str,
    payload: object,
) -> dict | None:
    """Reserve an idempotency key or return a completed replay response."""
    digest = request_hash(payload)
    existing = db.execute(
        text(
            "select request_hash, response_status, response_body from public.idempotency_keys "
            "where actor_id = :actor_id and operation = :operation and key = :key for update"
        ),
        {"actor_id": actor_id, "operation": operation, "key": key},
    ).mappings().first()
    if existing:
        if existing["request_hash"] != digest:
            raise HTTPException(status_code=409, detail="Idempotency key was already used with another request")
        if existing["response_status"] is None:
            raise HTTPException(status_code=409, detail="An identical operation is already being processed")
        return {"status": existing["response_status"], "body": existing["response_body"]}

    db.execute(
        text(
            "insert into public.idempotency_keys (actor_id, operation, key, request_hash) "
            "values (:actor_id, :operation, :key, :request_hash)"
        ),
        {"actor_id": actor_id, "operation": operation, "key": key, "request_hash": digest},
    )
    return None


def complete_idempotency_key(
    db: Session,
    *,
    actor_id: UUID,
    operation: str,
    key: str,
    response_status: int,
    response_body: dict,
) -> None:
    db.execute(
        text(
            "update public.idempotency_keys set response_status = :status, response_body = cast(:body as jsonb), "
            "completed_at = now() where actor_id = :actor_id and operation = :operation and key = :key"
        ),
        {
            "actor_id": actor_id,
            "operation": operation,
            "key": key,
            "status": response_status,
            "body": json.dumps(response_body, default=str),
        },
    )
