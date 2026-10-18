"""WebSocket endpoints for real-time game updates."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from jose import JWTError

from app.core.security import decode_access_token
from app.core.websocket import manager

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_ws_user_id(websocket: WebSocket) -> UUID | None:
    """Extract and validate user from WebSocket query token."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token")
        return None

    try:
        user = decode_access_token(token)
        return user.id
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return None


@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time game updates.

    Protocol:
    - Client connects with ?token=<jwt>
    - Client sends JSON commands: {"action": "join_room", "room_id": "aviator:round_id"}
    - Server broadcasts game events to subscribed rooms
    - Client sends {"action": "leave_room", "room_id": "..."} or {"action": "ping"}
    """
    user_id = await get_ws_user_id(websocket)
    if user_id is None:
        return

    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "ping":
                await websocket.send_json({"type": "pong"})

            elif action == "join_room":
                room_id = data.get("room_id")
                if room_id:
                    manager.join_room(user_id, room_id)
                    await websocket.send_json({
                        "type": "room_joined",
                        "room_id": room_id,
                        "room_size": manager.get_room_size(room_id),
                    })

            elif action == "leave_room":
                room_id = data.get("room_id")
                if room_id:
                    manager.leave_room(user_id, room_id)
                    await websocket.send_json({
                        "type": "room_left",
                        "room_id": room_id,
                    })

            elif action == "get_rooms":
                rooms = manager.get_user_rooms(user_id)
                await websocket.send_json({
                    "type": "rooms_list",
                    "rooms": list(rooms),
                })

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown action: {action}",
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)
