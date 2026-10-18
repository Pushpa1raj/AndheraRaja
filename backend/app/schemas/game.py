from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.game import AviatorRoundStatus, BetStatus, GameStatus, GameType, MinesSessionStatus


class GameOut(BaseModel):
    id: UUID
    type: GameType
    name: str
    status: GameStatus
    description: str
    current_config_version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GameConfigurationOut(BaseModel):
    id: UUID
    game_id: UUID
    version: int
    configuration: dict[str, Any]
    effective_at: datetime
    created_by: UUID
    change_reason: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AviatorRoundOut(BaseModel):
    id: UUID
    game_id: UUID
    configuration_id: UUID
    status: AviatorRoundStatus
    starts_at: datetime
    betting_closes_at: datetime
    crash_at: datetime
    server_seed_hash: str
    client_nonce: str
    fairness_algorithm: str
    crash_multiplier_bps: int
    revealed_server_seed: str | None
    cancellation_reason: str | None
    settled_at: datetime | None

    model_config = {"from_attributes": True}


class AviatorBetCreate(BaseModel):
    wager_amount: int = Field(gt=0, le=1_000_000_000)


class AviatorBetOut(BaseModel):
    id: UUID
    round_id: UUID
    user_id: UUID
    wager_amount: int
    status: BetStatus
    cashout_multiplier_bps: int | None
    payout_amount: int | None
    created_at: datetime
    settled_at: datetime | None

    model_config = {"from_attributes": True}


class MinesSessionCreate(BaseModel):
    wager_amount: int = Field(gt=0, le=1_000_000_000)
    grid_size: int = Field(ge=3, le=10)
    mine_count: int = Field(gt=0)
    client_nonce: str = Field(min_length=8, max_length=64)


class MinesCellReveal(BaseModel):
    cell_index: int = Field(ge=0)


class MinesSessionOut(BaseModel):
    id: UUID
    game_id: UUID
    user_id: UUID
    configuration_id: UUID
    status: MinesSessionStatus
    wager_amount: int
    grid_size: int
    mine_count: int
    server_seed_hash: str
    client_nonce: str
    fairness_algorithm: str
    revealed_cells: list[int]
    event_sequence: int
    current_multiplier_bps: int
    payout_amount: int | None
    revealed_server_seed: str | None
    revealed_mine_positions: list[int] | None
    created_at: datetime
    settled_at: datetime | None

    model_config = {"from_attributes": True}


class FairnessVerificationRequest(BaseModel):
    server_seed: str = Field(min_length=16, max_length=128)
    server_seed_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    game_type: GameType
    aggregate_id: str
    client_nonce: str


class FairnessVerificationResponse(BaseModel):
    hash_matches: bool
    computed_hash: str
    outcome: dict[str, Any]
