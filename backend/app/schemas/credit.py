from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.credit import CreditRequestStatus, TransactionType


class CreditAccountOut(BaseModel):
    user_id: UUID
    balance: int
    version: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditTransactionOut(BaseModel):
    id: UUID
    user_id: UUID
    type: TransactionType
    amount: int
    balance_before: int
    balance_after: int
    reference_type: str
    reference_id: UUID
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditRequestCreate(BaseModel):
    requested_amount: int = Field(gt=0, le=1_000_000_000)
    message: str | None = Field(default=None, max_length=1000)


class CreditRequestReview(BaseModel):
    decision: Literal["approved", "partially_approved", "rejected"]
    approved_amount: int | None = Field(default=None, gt=0, le=1_000_000_000)
    admin_note: str | None = Field(default=None, max_length=1000)

    @field_validator("approved_amount")
    @classmethod
    def no_non_integer_bool(cls, value: int | None) -> int | None:
        if isinstance(value, bool):
            raise ValueError("approved_amount must be an integer")
        return value


class CreditAllocationCreate(BaseModel):
    user_id: UUID
    amount: int = Field(gt=0, le=1_000_000_000)
    reason: str = Field(min_length=1, max_length=1000)


class CreditRequestOut(BaseModel):
    id: UUID
    user_id: UUID
    requested_amount: int
    approved_amount: int | None
    status: CreditRequestStatus
    message: str | None
    admin_note: str | None
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedCredits(BaseModel):
    items: list[CreditTransactionOut]
    page: int
    page_size: int
    total: int
