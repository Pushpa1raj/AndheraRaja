from fastapi import APIRouter
from app.api.v1 import users, credits, games, notifications, admin, ws

api_router = APIRouter()

api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(credits.router, prefix="/credits", tags=["credits"])
api_router.include_router(games.router, prefix="/games", tags=["games"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])
