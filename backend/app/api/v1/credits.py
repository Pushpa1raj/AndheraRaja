from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import (
    Page,
    claim_idempotency_key,
    complete_idempotency_key,
    pagination,
    require_idempotency_key,
)
from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.credit import CreditAccount, CreditRequest, CreditRequestStatus, CreditTransaction
from app.schemas.credit import (
    CreditAccountOut,
    CreditRequestCreate,
    CreditRequestOut,
    CreditTransactionOut,
    PaginatedCredits,
)
from app.services.notifications import create_notification

router = APIRouter()


@router.get("/balance", response_model=CreditAccountOut)
def get_credit_balance(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.get(CreditAccount, current_user.id)
    if account is None:
        account = CreditAccount(
            user_id=current_user.id,
            balance=1000,
            version=1,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


@router.get("/transactions", response_model=PaginatedCredits)
def get_credit_transactions(
    page: int = 1,
    page_size: int = 20,
    transaction_type: str | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pg = pagination(page, page_size)
    statement = select(CreditTransaction).where(CreditTransaction.user_id == current_user.id)
    count_statement = select(func.count()).select_from(CreditTransaction).where(CreditTransaction.user_id == current_user.id)
    if transaction_type:
        statement = statement.where(CreditTransaction.type == transaction_type)
        count_statement = count_statement.where(CreditTransaction.type == transaction_type)
    items = db.scalars(statement.order_by(CreditTransaction.created_at.desc()).offset(pg.offset).limit(pg.limit)).all()
    total = db.scalar(count_statement) or 0
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.post("/requests", response_model=CreditRequestOut, status_code=status.HTTP_201_CREATED)
def create_credit_request(
    payload: CreditRequestCreate,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit_request.create",
        key=idempotency_key,
        payload=payload_data,
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    request = CreditRequest(
        id=uuid4(),
        user_id=current_user.id,
        requested_amount=payload.requested_amount,
        message=payload.message,
        status=CreditRequestStatus.PENDING,
    )
    db.add(request)
    create_notification(
        db,
        user_id=current_user.id,
        notification_type="credit_request_submitted",
        title="Credit request submitted",
        message="Your virtual-credit request is pending review.",
        reference_type="credit_request",
        reference_id=request.id,
    )
    db.flush()
    response_body = CreditRequestOut.model_validate(request).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit_request.create",
        key=idempotency_key,
        response_status=status.HTTP_201_CREATED,
        response_body=response_body,
    )
    db.commit()
    return request


@router.get("/requests", response_model=list[CreditRequestOut])
def get_credit_requests(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(CreditRequest)
        .where(CreditRequest.user_id == current_user.id)
        .order_by(CreditRequest.created_at.desc())
    ).all()


@router.post("/requests/{request_id}/cancel", response_model=CreditRequestOut)
def cancel_credit_request(
    request_id: UUID,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    replay = claim_idempotency_key(
        db, actor_id=current_user.id, operation="credit_request.cancel", key=idempotency_key, payload={"request_id": request_id}
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    request = db.scalar(
        select(CreditRequest)
        .where(CreditRequest.id == request_id, CreditRequest.user_id == current_user.id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Credit request not found")
    if request.status != CreditRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending requests can be cancelled")
    request.status = CreditRequestStatus.CANCELLED
    db.flush()
    body = CreditRequestOut.model_validate(request).model_dump(mode="json")
    complete_idempotency_key(db, actor_id=current_user.id, operation="credit_request.cancel", key=idempotency_key, response_status=200, response_body=body)
    db.commit()
    return request
