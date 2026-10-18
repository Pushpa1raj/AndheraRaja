from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.notification import NotificationType


class Notification(BaseModel):
    id: str
    user_id: str
    type: NotificationType
    title: str
    message: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
