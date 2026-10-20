import enum
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GameType(str, enum.Enum):
    AVIATOR = "aviator"
    MINES = "mines"


class GameStatus(str, enum.Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"


class AviatorRoundStatus(str, enum.Enum):
    WAITING = "waiting"
    RUNNING = "running"
    CRASHED = "crashed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class BetStatus(str, enum.Enum):
    PLACED = "placed"
    CASHED_OUT = "cashed_out"
    LOST = "lost"
    CANCELLED = "cancelled"


class MinesSessionStatus(str, enum.Enum):
    RUNNING = "running"
    CASHED_OUT = "cashed_out"
    LOST = "lost"
    CANCELLED = "cancelled"


class Game(Base):
    __tablename__ = "games"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    type: Mapped[GameType] = mapped_column(Enum(GameType, name="game_type", create_type=False, values_callable=lambda x: [e.value for e in x]), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus, name="game_status", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    current_config_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GameConfiguration(Base):
    __tablename__ = "game_configurations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    game_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("games.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration: Mapped[dict] = mapped_column(JSONB, nullable=False)
    effective_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AviatorRound(Base):
    __tablename__ = "aviator_rounds"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    game_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("games.id"), nullable=False)
    configuration_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("game_configurations.id"), nullable=False)
    status: Mapped[AviatorRoundStatus] = mapped_column(Enum(AviatorRoundStatus, name="aviator_round_status", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    starts_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    betting_closes_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    crash_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String, nullable=False)
    encrypted_server_seed: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    client_nonce: Mapped[str] = mapped_column(String, nullable=False)
    fairness_algorithm: Mapped[str] = mapped_column(String, nullable=False)
    crash_multiplier_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    revealed_server_seed: Mapped[str | None] = mapped_column(String, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    settled_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AviatorBet(Base):
    __tablename__ = "aviator_bets"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    round_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("aviator_rounds.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    wager_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[BetStatus] = mapped_column(Enum(BetStatus, name="bet_status", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    cashout_multiplier_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payout_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    wager_transaction_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    payout_transaction_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    settled_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MinesSession(Base):
    __tablename__ = "mines_sessions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    game_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("games.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    configuration_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("game_configurations.id"), nullable=False)
    status: Mapped[MinesSessionStatus] = mapped_column(Enum(MinesSessionStatus, name="mines_session_status", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    wager_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    grid_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mine_count: Mapped[int] = mapped_column(Integer, nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String, nullable=False)
    encrypted_server_seed: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    client_nonce: Mapped[str] = mapped_column(String, nullable=False)
    fairness_algorithm: Mapped[str] = mapped_column(String, nullable=False)
    revealed_cells: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    event_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    current_multiplier_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    payout_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    wager_transaction_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    payout_transaction_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    revealed_server_seed: Mapped[str | None] = mapped_column(String, nullable=True)
    revealed_mine_positions: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    settled_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
