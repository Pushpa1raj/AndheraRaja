from app.schemas.user import User, UserCreate, UserUpdate
from app.schemas.credit import (
    CreditAccountOut,
    CreditTransactionOut,
    CreditRequestOut,
    CreditRequestCreate,
    CreditRequestReview,
    CreditAllocationCreate,
)
# Backwards compatibility aliases
CreditAccount = CreditAccountOut
CreditTransaction = CreditTransactionOut
CreditRequest = CreditRequestOut

from app.schemas.game import (
    GameOut,
    GameConfigurationOut,
    AviatorRoundOut,
    AviatorBetCreate,
    AviatorBetOut,
    MinesSessionCreate,
    MinesCellReveal,
    MinesSessionOut,
    FairnessVerificationRequest,
    FairnessVerificationResponse,
)
# Backwards compatibility aliases
Game = GameOut
GameSession = MinesSessionOut
GameSessionCreate = MinesSessionCreate

from app.schemas.notification import Notification

__all__ = [
    "User",
    "UserCreate",
    "UserUpdate",
    "CreditAccount",
    "CreditTransaction",
    "CreditRequest",
    "CreditRequestCreate",
    "Game",
    "GameOut",
    "GameSession",
    "GameSessionCreate",
    "AviatorRoundOut",
    "AviatorBetCreate",
    "AviatorBetOut",
    "MinesSessionCreate",
    "MinesCellReveal",
    "MinesSessionOut",
    "FairnessVerificationRequest",
    "FairnessVerificationResponse",
    "Notification",
]
