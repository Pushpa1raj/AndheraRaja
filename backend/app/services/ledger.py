"""The sole application path for virtual-credit balance mutations."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.credit import CreditTransaction, TransactionType


class InsufficientCreditsError(ValueError):
    pass


def apply_transaction(
    db: Session,
    *,
    user_id: UUID,
    transaction_type: TransactionType,
    amount: int,
    reference_type: str,
    reference_id: UUID,
    reason: str | None = None,
) -> CreditTransaction:
    """Lock the account and make an immutable credit movement.

    The database function in the baseline migration owns the `FOR UPDATE` lock,
    balance check, account update, and ledger insert. Callers must invoke this in
    the same transaction as their domain mutation.
    """
    if not isinstance(amount, int) or isinstance(amount, bool) or amount == 0:
        raise ValueError("Credit transaction amount must be a non-zero integer")

    try:
        result = db.execute(
            text(
                "select * from public.apply_credit_transaction("
                ":user_id, :transaction_type, :amount, :reference_type, :reference_id, :reason)"
            ),
            {
                "user_id": user_id,
                "transaction_type": transaction_type.value,
                "amount": amount,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "reason": reason,
            },
        ).mappings().one()
    except Exception as exc:
        if "Insufficient virtual credits" in str(exc):
            raise InsufficientCreditsError("Insufficient virtual credits") from exc
        raise

    return db.get(CreditTransaction, result["id"])
