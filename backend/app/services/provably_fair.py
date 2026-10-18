"""Deterministic, player-verifiable game outcome helpers.

The API stores a hash commitment before interaction and reveals the server seed only
when a round/session settles. All values below are deterministic given the published
inputs, so independent verifiers can reproduce an outcome exactly.
"""

from __future__ import annotations

import hashlib
import hmac
import math
import secrets
from dataclasses import dataclass
from typing import Iterable
from uuid import UUID

ALGORITHM_VERSION = "hmac-sha256-v1"
BASIS_POINTS = 10_000


@dataclass(frozen=True)
class SeedCommitment:
    server_seed: str
    server_seed_hash: str


def create_seed_commitment() -> SeedCommitment:
    server_seed = secrets.token_hex(32)
    return SeedCommitment(
        server_seed=server_seed,
        server_seed_hash=hashlib.sha256(server_seed.encode("utf-8")).hexdigest(),
    )


def verify_seed_commitment(server_seed: str, expected_hash: str) -> bool:
    actual = hashlib.sha256(server_seed.encode("utf-8")).hexdigest()
    return hmac.compare_digest(actual, expected_hash.lower())


def _digest(server_seed: str, game: str, aggregate_id: UUID | str, client_nonce: str, nonce: int = 0) -> bytes:
    message = f"{ALGORITHM_VERSION}:{game}:{aggregate_id}:{client_nonce}:{nonce}".encode("utf-8")
    return hmac.new(server_seed.encode("utf-8"), message, hashlib.sha256).digest()


def _unit_interval(server_seed: str, game: str, aggregate_id: UUID | str, client_nonce: str, nonce: int = 0) -> float:
    # 53-bit source is exactly representable in JavaScript for independent browser verification.
    raw = int.from_bytes(_digest(server_seed, game, aggregate_id, client_nonce, nonce)[:8], "big") >> 11
    return raw / float(1 << 53)


def aviator_crash_multiplier_bps(
    server_seed: str,
    round_id: UUID | str,
    client_nonce: str,
    max_multiplier_bps: int,
) -> int:
    """Return the committed Aviator crash multiplier in basis points.

    Formula: floor(99 / (1-u)) percent, clamped to [1.00x, max]. The 1% edge
    and floor-to-basis-point settlement rule are intentionally explicit in game
    rules and can be verified from the released inputs.
    """
    if max_multiplier_bps < BASIS_POINTS:
        raise ValueError("max_multiplier_bps must be at least 10000")
    unit = _unit_interval(server_seed, "aviator", round_id, client_nonce)
    multiplier_bps = math.floor((0.99 / (1.0 - unit)) * BASIS_POINTS)
    return max(BASIS_POINTS, min(multiplier_bps, max_multiplier_bps))


def mines_positions(
    server_seed: str,
    session_id: UUID | str,
    client_nonce: str,
    total_cells: int,
    mine_count: int,
) -> tuple[int, ...]:
    """Create a deterministic Fisher–Yates mine board without modulo bias."""
    if total_cells < 4 or not 0 < mine_count < total_cells:
        raise ValueError("invalid board dimensions or mine count")
    cells = list(range(total_cells))
    for index in range(total_cells - 1, 0, -1):
        nonce = total_cells - 1 - index
        bound = (1 << 256) - ((1 << 256) % (index + 1))
        while True:
            draw = int.from_bytes(_digest(server_seed, "mines", session_id, client_nonce, nonce), "big")
            if draw < bound:
                break
            nonce += total_cells
        swap_index = draw % (index + 1)
        cells[index], cells[swap_index] = cells[swap_index], cells[index]
    return tuple(sorted(cells[:mine_count]))


def mines_multiplier_bps(total_cells: int, mine_count: int, safe_reveals: int) -> int:
    """Return floor(10000 * fair odds multiplier) after safe reveals.

    Fair multiplier is the reciprocal probability of surviving the selected safe
    cells. Results settle down to basis points, a published player-favorable-safe
    deterministic rounding rule (the backend uses the same integer value).
    """
    safe_cells = total_cells - mine_count
    if not (0 <= safe_reveals <= safe_cells):
        raise ValueError("invalid number of safe reveals")
    numerator = 1
    denominator = 1
    for revealed in range(safe_reveals):
        numerator *= total_cells - revealed
        denominator *= safe_cells - revealed
    return (BASIS_POINTS * numerator) // denominator


def payout_credits(wager_credits: int, multiplier_bps: int) -> int:
    if wager_credits <= 0 or multiplier_bps < BASIS_POINTS:
        raise ValueError("invalid wager or multiplier")
    return (wager_credits * multiplier_bps) // BASIS_POINTS
