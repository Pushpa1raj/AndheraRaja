"""Admin-only endpoints for user and credit management."""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import (
    Page,
    claim_idempotency_key,
    complete_idempotency_key,
    pagination,
    require_idempotency_key,
)
from app.core.security import AuthenticatedUser, get_current_admin_user
from app.db.session import get_db
from app.models.credit import CreditRequest, CreditRequestStatus, CreditTransaction, TransactionType
from app.models.user import User
from app.schemas.credit import (
    CreditAllocationCreate,
    CreditRequestOut,
    CreditRequestReview,
    CreditTransactionOut,
    PaginatedCredits,
)
from app.schemas.user import User as UserOut
from app.services.audit import record_audit
from app.services.ledger import apply_transaction
from app.services.notifications import create_notification

router = APIRouter()


@router.get("/dashboard")
def get_admin_dashboard(
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get admin dashboard statistics."""
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    pending_requests_count = db.scalar(
        select(func.count())
        .select_from(CreditRequest)
        .where(CreditRequest.status == CreditRequestStatus.PENDING)
    ) or 0

    return {
        "total_users": total_users,
        "pending_credit_requests": pending_requests_count,
    }


@router.get("/users", response_model=list[UserOut])
def list_users_admin(
    page: int = 1,
    page_size: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    pg = pagination(page, page_size)
    return db.scalars(
        select(User)
        .order_by(User.created_at.desc())
        .offset(pg.offset)
        .limit(pg.limit)
    ).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user_admin(
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get user details (admin only)."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/credits/allocate", response_model=CreditTransactionOut, status_code=status.HTTP_201_CREATED)
def allocate_credits(
    payload: CreditAllocationCreate,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Allocate virtual credits to a user (admin only)."""
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit.allocate",
        key=idempotency_key,
        payload=payload_data,
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Verify target user exists
    target_user = db.get(User, payload.user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Create allocation transaction
    allocation_id = uuid4()
    transaction = apply_transaction(
        db,
        user_id=payload.user_id,
        transaction_type=TransactionType.ADMIN_ALLOCATION,
        amount=payload.amount,
        reference_type="admin_allocation",
        reference_id=allocation_id,
        reason=payload.reason,
    )

    # Audit the action
    record_audit(
        db,
        administrator_id=current_user.id,
        action="credit_allocation",
        target_type="user",
        target_id=payload.user_id,
        reason=payload.reason,
        new_state={"amount": payload.amount, "transaction_id": str(transaction.id)},
    )

    # Notify the user
    create_notification(
        db,
        user_id=payload.user_id,
        notification_type="credits_allocated",
        title="Virtual credits allocated",
        message=f"An administrator allocated {payload.amount} virtual credits to your account.",
        reference_type="credit_transaction",
        reference_id=transaction.id,
    )

    db.flush()
    response_body = CreditTransactionOut.model_validate(transaction).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit.allocate",
        key=idempotency_key,
        response_status=status.HTTP_201_CREATED,
        response_body=response_body,
    )
    db.commit()
    return transaction


@router.get("/credit-requests", response_model=list[CreditRequestOut])
def list_credit_requests_admin(
    status_filter: CreditRequestStatus | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all credit requests (admin only)."""
    pg = pagination(page, page_size)
    statement = select(CreditRequest)
    if status_filter:
        statement = statement.where(CreditRequest.status == status_filter)
    return db.scalars(
        statement.order_by(CreditRequest.created_at.desc())
        .offset(pg.offset)
        .limit(pg.limit)
    ).all()


@router.patch("/credit-requests/{request_id}", response_model=CreditRequestOut)
def review_credit_request(
    request_id: UUID,
    payload: CreditRequestReview,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Approve, partially approve, or reject a credit request (admin only)."""
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit_request.review",
        key=idempotency_key,
        payload={"request_id": str(request_id), **payload_data},
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Lock and retrieve the request
    request = db.scalar(
        select(CreditRequest)
        .where(CreditRequest.id == request_id)
        .with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Credit request not found")
    if request.status != CreditRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending requests can be reviewed")

    # Update request based on decision
    if payload.decision == "rejected":
        request.status = CreditRequestStatus.REJECTED
        request.reviewed_by = current_user.id
        request.reviewed_at = func.now()
        request.admin_note = payload.admin_note
        notification_type = "credit_request_rejected"
        notification_message = "Your credit request was not approved."
    else:
        if payload.approved_amount is None:
            raise HTTPException(status_code=422, detail="approved_amount is required for approval")
        if payload.approved_amount <= 0:
            raise HTTPException(status_code=422, detail="approved_amount must be positive")

        # Allocate the credits
        transaction = apply_transaction(
            db,
            user_id=request.user_id,
            transaction_type=TransactionType.ADMIN_ALLOCATION,
            amount=payload.approved_amount,
            reference_type="credit_request",
            reference_id=request.id,
            reason=f"Credit request approval: {payload.admin_note or 'Approved'}",
        )

        if payload.approved_amount >= request.requested_amount:
            request.status = CreditRequestStatus.APPROVED
            notification_type = "credit_request_approved"
            notification_message = f"Your credit request was approved. {payload.approved_amount} credits have been added to your account."
        else:
            request.status = CreditRequestStatus.PARTIALLY_APPROVED
            notification_type = "credit_request_partially_approved"
            notification_message = f"Your credit request was partially approved. {payload.approved_amount} credits (of {request.requested_amount} requested) have been added."

        request.approved_amount = payload.approved_amount
        request.reviewed_by = current_user.id
        request.reviewed_at = func.now()
        request.admin_note = payload.admin_note

    # Audit the review
    record_audit(
        db,
        administrator_id=current_user.id,
        action="credit_request_review",
        target_type="credit_request",
        target_id=request.id,
        reason=payload.admin_note,
        new_state={
            "decision": payload.decision,
            "approved_amount": payload.approved_amount,
            "status": request.status.value,
        },
    )

    # Notify the user
    create_notification(
        db,
        user_id=request.user_id,
        notification_type=notification_type,
        title="Credit request reviewed",
        message=notification_message,
        reference_type="credit_request",
        reference_id=request.id,
    )

    db.flush()
    response_body = CreditRequestOut.model_validate(request).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="credit_request.review",
        key=idempotency_key,
        response_status=200,
        response_body=response_body,
    )
    db.commit()
    return request


@router.get("/transactions", response_model=PaginatedCredits)
def list_all_transactions_admin(
    user_id: UUID | None = None,
    transaction_type: TransactionType | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all credit transactions with optional filters (admin only)."""
    pg = pagination(page, page_size)
    statement = select(CreditTransaction)
    count_statement = select(func.count()).select_from(CreditTransaction)

    if user_id:
        statement = statement.where(CreditTransaction.user_id == user_id)
        count_statement = count_statement.where(CreditTransaction.user_id == user_id)
    if transaction_type:
        statement = statement.where(CreditTransaction.type == transaction_type)
        count_statement = count_statement.where(CreditTransaction.type == transaction_type)

    items = db.scalars(
        statement.order_by(CreditTransaction.created_at.desc())
        .offset(pg.offset)
        .limit(pg.limit)
    ).all()
    total = db.scalar(count_statement) or 0

    return {"items": items, "page": page, "page_size": page_size, "total": total}
