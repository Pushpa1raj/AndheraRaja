from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter()


@router.get("/")
async def get_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Get current user's notifications."""
    return {"notifications": [], "message": "Notifications endpoint - to be implemented"}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as read."""
    return {"message": f"Mark notification {notification_id} as read - to be implemented"}
