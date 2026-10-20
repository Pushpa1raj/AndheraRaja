from uuid import UUID
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    email: EmailStr
    display_name: str


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class User(UserBase):
    id: UUID
    avatar_url: Optional[str] = None
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
