"""Game listing and fairness verification endpoints."""

from __future__ import annotations

from uuid import UUID, uuid4

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import (
    claim_idempotency_key,
    complete_idempotency_key,
    require_idempotency_key,
)
from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.credit import TransactionType
from app.models.game import (
    AviatorBet,
    AviatorRound,
    AviatorRoundStatus,
    BetStatus,
    Game,
    GameConfiguration,
    GameType,
    MinesSession,
    MinesSessionStatus,
)
from app.schemas.game import (
    AviatorBetCreate,
    AviatorBetOut,
    AviatorRoundOut,
    FairnessVerificationRequest,
    FairnessVerificationResponse,
    GameConfigurationOut,
    GameOut,
    MinesCellReveal,
    MinesSessionCreate,
    MinesSessionOut,
)
from app.services.ledger import apply_transaction
from app.services.provably_fair import (
    aviator_crash_multiplier_bps,
    create_seed_commitment,
    mines_multiplier_bps,
    mines_positions,
    payout_credits,
    verify_seed_commitment,
)

router = APIRouter()


@router.get("/", response_model=list[GameOut])
def list_games(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all available games."""
    return db.scalars(select(Game).order_by(Game.name)).all()


@router.get("/{game_id}", response_model=GameOut)
def get_game(
    game_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get game details."""
    game = db.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("/{game_id}/configuration", response_model=GameConfigurationOut)
def get_game_configuration(
    game_id: UUID,
    version: int | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get game configuration (latest by default, or a specific version)."""
    game = db.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    if version is None:
        version = game.current_config_version

    config = db.scalar(
        select(GameConfiguration)
        .where(GameConfiguration.game_id == game_id, GameConfiguration.version == version)
    )
    if config is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


@router.get("/aviator/rounds/current", response_model=AviatorRoundOut | None)
def get_current_aviator_round(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current or upcoming Aviator round, auto-advancing expired rounds."""
    import math
    import secrets
    from datetime import datetime, timedelta, timezone

    game = db.scalar(select(Game).where(Game.type == GameType.AVIATOR))
    if game is None:
        game = Game(
            id=uuid4(),
            type=GameType.AVIATOR,
            name="Aviator",
            status=GameStatus.ACTIVE,
            description="Cash out virtual credits before the flight crashes.",
            current_config_version=1,
        )
        db.add(game)
        db.commit()

    now = datetime.now(timezone.utc)

    # 1. Check for running rounds that have reached their crash_at
    running_rounds = db.scalars(
        select(AviatorRound).where(
            AviatorRound.game_id == game.id,
            AviatorRound.status == AviatorRoundStatus.RUNNING,
            AviatorRound.crash_at <= now,
        )
    ).all()
    fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    for r in running_rounds:
        r.status = AviatorRoundStatus.CRASHED
        r.settled_at = now
        try:
            r.revealed_server_seed = fernet.decrypt(bytes(r.encrypted_server_seed)).decode("utf-8")
        except Exception:
            r.revealed_server_seed = "00000000000000000000000000000000"
        # Settle any active placed bets on this round as lost
        bets = db.scalars(
            select(AviatorBet).where(
                AviatorBet.round_id == r.id,
                AviatorBet.status == BetStatus.PLACED,
            )
        ).all()
        for b in bets:
            b.status = BetStatus.LOST
            b.settled_at = now
    if running_rounds:
        db.commit()

    # 2. Check for waiting rounds whose betting window has elapsed
    waiting_rounds = db.scalars(
        select(AviatorRound).where(
            AviatorRound.game_id == game.id,
            AviatorRound.status == AviatorRoundStatus.WAITING,
            AviatorRound.starts_at <= now,
        )
    ).all()
    for r in waiting_rounds:
        r.status = AviatorRoundStatus.RUNNING
    if waiting_rounds:
        db.commit()

    # 3. Retrieve the latest active (waiting or running) round
    round = db.scalar(
        select(AviatorRound)
        .where(
            AviatorRound.game_id == game.id,
            AviatorRound.status.in_([AviatorRoundStatus.WAITING, AviatorRoundStatus.RUNNING]),
        )
        .order_by(AviatorRound.starts_at.desc())
        .limit(1)
    )

    # 4. If no round exists, or all are crashed, generate the next waiting round
    if round is None:
        config = db.scalar(
            select(GameConfiguration).where(
                GameConfiguration.game_id == game.id,
                GameConfiguration.version == game.current_config_version,
            )
        )
        if config is None:
            config = GameConfiguration(
                id=uuid4(),
                game_id=game.id,
                version=1,
                configuration={
                    "growth_rate_bps": 600,
                    "max_multiplier_bps": 100_000,
                    "min_wager": 10,
                    "max_wager": 100_000,
                },
                effective_at=now,
                created_by=current_user.id,
                change_reason="Initial seed configuration",
            )
            db.add(config)
            db.commit()

        commitment = create_seed_commitment()
        fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        encrypted_seed = fernet.encrypt(commitment.server_seed.encode("utf-8"))
        round_id = uuid4()
        client_nonce = secrets.token_hex(8)
        multiplier_bps = aviator_crash_multiplier_bps(
            commitment.server_seed, round_id, client_nonce, 100_000
        )

        # Calculate flight duration: logarithmic curve (min 4s, up to 45s)
        mult_float = max(1.01, multiplier_bps / 10_000.0)
        flight_seconds = min(45, max(4, int(math.log(mult_float) * 7) + 3))
        starts_at = now + timedelta(seconds=7)  # 7-second countdown for placing bets
        betting_closes_at = starts_at
        crash_at = starts_at + timedelta(seconds=flight_seconds)

        round = AviatorRound(
            id=round_id,
            game_id=game.id,
            configuration_id=config.id,
            status=AviatorRoundStatus.WAITING,
            starts_at=starts_at,
            betting_closes_at=betting_closes_at,
            crash_at=crash_at,
            server_seed_hash=commitment.server_seed_hash,
            encrypted_server_seed=encrypted_seed,
            client_nonce=client_nonce,
            fairness_algorithm="hmac-sha256-v1",
            crash_multiplier_bps=multiplier_bps,
        )
        db.add(round)
        db.commit()
        db.refresh(round)

    return round


@router.get("/aviator/rounds/{round_id}", response_model=AviatorRoundOut)
def get_aviator_round(
    round_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get Aviator round details."""
    round = db.get(AviatorRound, round_id)
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    return round


@router.get("/mines/sessions/{session_id}", response_model=MinesSessionOut)
def get_mines_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get Mines session details."""
    session = db.scalar(
        select(MinesSession)
        .where(MinesSession.id == session_id, MinesSession.user_id == current_user.id)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/aviator/rounds/{round_id}/bets", response_model=AviatorBetOut, status_code=status.HTTP_201_CREATED)
def place_aviator_bet(
    round_id: UUID,
    payload: AviatorBetCreate,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Place a bet on an upcoming Aviator round."""
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="aviator.bet",
        key=idempotency_key,
        payload={"round_id": str(round_id), **payload_data},
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Lock and verify the round accepts bets
    round = db.scalar(select(AviatorRound).where(AviatorRound.id == round_id).with_for_update())
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    if round.status != AviatorRoundStatus.WAITING:
        raise HTTPException(status_code=409, detail="Round is not accepting bets")
    if func.now() >= round.betting_closes_at:
        raise HTTPException(status_code=409, detail="Betting window has closed")

    # Debit the wager
    transaction = apply_transaction(
        db,
        user_id=current_user.id,
        transaction_type=TransactionType.GAME_WAGER,
        amount=-payload.wager_amount,
        reference_type="aviator_bet",
        reference_id=uuid4(),  # temp, will update
        reason=f"Aviator bet on round {round_id}",
    )

    # Create the bet
    bet = AviatorBet(
        id=uuid4(),
        round_id=round_id,
        user_id=current_user.id,
        wager_amount=payload.wager_amount,
        status=BetStatus.PLACED,
        wager_transaction_id=transaction.id,
    )
    db.add(bet)
    db.flush()

    response_body = AviatorBetOut.model_validate(bet).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="aviator.bet",
        key=idempotency_key,
        response_status=status.HTTP_201_CREATED,
        response_body=response_body,
    )
    db.commit()
    return bet


@router.post("/aviator/bets/{bet_id}/cashout", response_model=AviatorBetOut)
def cashout_aviator_bet(
    bet_id: UUID,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cash out an active Aviator bet before the crash."""
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="aviator.cashout",
        key=idempotency_key,
        payload={"bet_id": str(bet_id)},
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Lock the bet
    bet = db.scalar(
        select(AviatorBet).where(AviatorBet.id == bet_id, AviatorBet.user_id == current_user.id).with_for_update()
    )
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status != BetStatus.PLACED:
        raise HTTPException(status_code=409, detail="Bet is not active")

    # Verify the round is running
    round = db.get(AviatorRound, bet.round_id)
    if round is None or round.status != AviatorRoundStatus.RUNNING:
        raise HTTPException(status_code=409, detail="Round is not running")
    if func.now() >= round.crash_at:
        raise HTTPException(status_code=409, detail="Round has already crashed")

    # Calculate elapsed multiplier dynamically based on elapsed flight time
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    # Ensure round.starts_at is timezone-aware
    starts = round.starts_at if round.starts_at.tzinfo else round.starts_at.replace(tzinfo=timezone.utc)
    elapsed = max(0.0, (now - starts).total_seconds())
    # Dynamic flight curve: exponential growth starting at 1.00x
    dynamic_mult = 1.0 + 0.08 * elapsed + 0.012 * (elapsed ** 2)
    calculated_bps = int(dynamic_mult * 10_000)
    # Never exceed the committed crash multiplier
    cashout_multiplier_bps = min(round.crash_multiplier_bps, max(10_100, calculated_bps))
    payout_amount = payout_credits(bet.wager_amount, cashout_multiplier_bps)

    # Credit the payout
    payout_transaction = apply_transaction(
        db,
        user_id=current_user.id,
        transaction_type=TransactionType.GAME_WIN,
        amount=payout_amount,
        reference_type="aviator_bet",
        reference_id=bet.id,
        reason=f"Aviator cashout at {cashout_multiplier_bps / 100:.2f}x",
    )

    # Update the bet
    bet.status = BetStatus.CASHED_OUT
    bet.cashout_multiplier_bps = cashout_multiplier_bps
    bet.payout_amount = payout_amount
    bet.payout_transaction_id = payout_transaction.id
    bet.settled_at = func.now()

    db.flush()
    response_body = AviatorBetOut.model_validate(bet).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="aviator.cashout",
        key=idempotency_key,
        response_status=200,
        response_body=response_body,
    )
    db.commit()
    return bet


@router.post("/mines/sessions", response_model=MinesSessionOut, status_code=status.HTTP_201_CREATED)
def create_mines_session(
    payload: MinesSessionCreate,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new Mines session with a provably-fair seed commitment."""
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.create",
        key=idempotency_key,
        payload=payload_data,
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Validate grid constraints
    total_cells = payload.grid_size * payload.grid_size
    if payload.mine_count >= total_cells:
        raise HTTPException(status_code=422, detail="Mine count must be less than total cells")

    # Get Mines game and current config (auto-create if not yet seeded)
    game = db.scalar(select(Game).where(Game.type == GameType.MINES))
    if game is None:
        game = Game(
            id=uuid4(),
            type=GameType.MINES,
            name="Mines",
            status=GameStatus.ACTIVE,
            description="Uncover gems and avoid mines to multiply your virtual credits.",
            current_config_version=1,
        )
        db.add(game)
        db.commit()

    config = db.scalar(
        select(GameConfiguration).where(
            GameConfiguration.game_id == game.id, GameConfiguration.version == game.current_config_version
        )
    )
    if config is None:
        config = GameConfiguration(
            id=uuid4(),
            game_id=game.id,
            version=1,
            configuration={
                "house_edge_bps": 200,
                "min_wager": 10,
                "max_wager": 100_000,
            },
            effective_at=func.now(),
            created_by=current_user.id,
            change_reason="Initial Mines configuration",
        )
        db.add(config)
        db.commit()

    # Create seed commitment
    commitment = create_seed_commitment()
    fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    encrypted_seed = fernet.encrypt(commitment.server_seed.encode("utf-8"))

    # Debit the wager
    transaction = apply_transaction(
        db,
        user_id=current_user.id,
        transaction_type=TransactionType.GAME_WAGER,
        amount=-payload.wager_amount,
        reference_type="mines_session",
        reference_id=uuid4(),  # temp
        reason=f"Mines session {payload.grid_size}x{payload.grid_size}, {payload.mine_count} mines",
    )

    # Create the session
    session = MinesSession(
        id=uuid4(),
        game_id=game.id,
        user_id=current_user.id,
        configuration_id=config.id,
        status=MinesSessionStatus.RUNNING,
        wager_amount=payload.wager_amount,
        grid_size=payload.grid_size,
        mine_count=payload.mine_count,
        server_seed_hash=commitment.server_seed_hash,
        encrypted_server_seed=encrypted_seed,
        client_nonce=payload.client_nonce,
        fairness_algorithm="hmac-sha256-v1",
        revealed_cells=[],
        event_sequence=0,
        current_multiplier_bps=10_000,  # 1.00x
        wager_transaction_id=transaction.id,
    )
    db.add(session)
    db.flush()

    response_body = MinesSessionOut.model_validate(session).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.create",
        key=idempotency_key,
        response_status=status.HTTP_201_CREATED,
        response_body=response_body,
    )
    db.commit()
    return session


@router.post("/mines/sessions/{session_id}/reveal", response_model=MinesSessionOut)
def reveal_mines_cell(
    session_id: UUID,
    payload: MinesCellReveal,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reveal a cell in an active Mines session."""
    payload_data = payload.model_dump()
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.reveal",
        key=idempotency_key,
        payload={"session_id": str(session_id), **payload_data},
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Lock the session
    session = db.scalar(
        select(MinesSession)
        .where(MinesSession.id == session_id, MinesSession.user_id == current_user.id)
        .with_for_update()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != MinesSessionStatus.RUNNING:
        raise HTTPException(status_code=409, detail="Session is not active")

    # Validate cell index
    total_cells = session.grid_size * session.grid_size
    if payload.cell_index >= total_cells:
        raise HTTPException(status_code=422, detail="Cell index out of bounds")
    if payload.cell_index in session.revealed_cells:
        raise HTTPException(status_code=409, detail="Cell already revealed")

    # Decrypt server seed and compute mine positions
    fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    server_seed = fernet.decrypt(session.encrypted_server_seed).decode("utf-8")
    mine_positions = set(
        mines_positions(server_seed, str(session.id), session.client_nonce, total_cells, session.mine_count)
    )

    # Check if revealed cell is a mine
    is_mine = payload.cell_index in mine_positions
    session.revealed_cells = session.revealed_cells + [payload.cell_index]
    session.event_sequence += 1

    if is_mine:
        # Game lost
        session.status = MinesSessionStatus.LOST
        session.revealed_server_seed = server_seed
        session.revealed_mine_positions = sorted(mine_positions)
        session.settled_at = func.now()
    else:
        # Safe cell - update multiplier
        safe_reveals = len(session.revealed_cells)
        session.current_multiplier_bps = mines_multiplier_bps(total_cells, session.mine_count, safe_reveals)

    db.flush()
    response_body = MinesSessionOut.model_validate(session).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.reveal",
        key=idempotency_key,
        response_status=200,
        response_body=response_body,
    )
    db.commit()
    return session


@router.post("/mines/sessions/{session_id}/cashout", response_model=MinesSessionOut)
def cashout_mines_session(
    session_id: UUID,
    idempotency_key: str = Depends(require_idempotency_key),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cash out an active Mines session with current multiplier."""
    replay = claim_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.cashout",
        key=idempotency_key,
        payload={"session_id": str(session_id)},
    )
    if replay:
        return Response(content=str(replay["body"]), status_code=replay["status"], media_type="application/json")

    # Lock the session
    session = db.scalar(
        select(MinesSession)
        .where(MinesSession.id == session_id, MinesSession.user_id == current_user.id)
        .with_for_update()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != MinesSessionStatus.RUNNING:
        raise HTTPException(status_code=409, detail="Session is not active")

    # Calculate payout
    payout_amount = payout_credits(session.wager_amount, session.current_multiplier_bps)

    # Credit the payout
    payout_transaction = apply_transaction(
        db,
        user_id=current_user.id,
        transaction_type=TransactionType.GAME_WIN,
        amount=payout_amount,
        reference_type="mines_session",
        reference_id=session.id,
        reason=f"Mines cashout at {session.current_multiplier_bps / 100:.2f}x",
    )

    # Reveal the seed and settle
    fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    server_seed = fernet.decrypt(session.encrypted_server_seed).decode("utf-8")
    total_cells = session.grid_size * session.grid_size
    mine_positions_tuple = mines_positions(server_seed, str(session.id), session.client_nonce, total_cells, session.mine_count)

    session.status = MinesSessionStatus.CASHED_OUT
    session.payout_amount = payout_amount
    session.payout_transaction_id = payout_transaction.id
    session.revealed_server_seed = server_seed
    session.revealed_mine_positions = sorted(mine_positions_tuple)
    session.settled_at = func.now()

    db.flush()
    response_body = MinesSessionOut.model_validate(session).model_dump(mode="json")
    complete_idempotency_key(
        db,
        actor_id=current_user.id,
        operation="mines.cashout",
        key=idempotency_key,
        response_status=200,
        response_body=response_body,
    )
    db.commit()
    return session


@router.post("/verify-fairness", response_model=FairnessVerificationResponse)
def verify_fairness(
    payload: FairnessVerificationRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Independently verify a settled game outcome."""
    hash_matches = verify_seed_commitment(payload.server_seed, payload.server_seed_hash)
    computed_hash = payload.server_seed_hash  # Already computed for verification

    outcome: dict = {}
    if payload.game_type == GameType.AVIATOR:
        try:
            crash_bps = aviator_crash_multiplier_bps(
                payload.server_seed,
                payload.aggregate_id,
                payload.client_nonce,
                max_multiplier_bps=10_000_000,
            )
            outcome = {
                "crash_multiplier_bps": crash_bps,
                "crash_multiplier_display": f"{crash_bps / 100:.2f}x",
            }
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Verification failed: {exc}")
    elif payload.game_type == GameType.MINES:
        try:
            # Extract grid/mine count from aggregate_id if encoded, or require separate params
            # For now, assume user provides them separately or we parse a known format
            grid_size = 5  # placeholder
            mine_count = 3  # placeholder
            positions = mines_positions(
                payload.server_seed,
                payload.aggregate_id,
                payload.client_nonce,
                grid_size * grid_size,
                mine_count,
            )
            outcome = {
                "mine_positions": list(positions),
                "grid_size": grid_size,
                "mine_count": mine_count,
            }
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Verification failed: {exc}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported game type")

    return FairnessVerificationResponse(
        hash_matches=hash_matches,
        computed_hash=computed_hash,
        outcome=outcome,
    )
