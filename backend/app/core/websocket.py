"""WebSocket connection manager for real-time game updates."""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections and room-based broadcasting."""

    def __init__(self):
        # Active connections by user_id
        self.active_connections: dict[UUID, list[WebSocket]] = defaultdict(list)
        # Room subscriptions: room_id -> set of user_ids
        self.rooms: dict[str, set[UUID]] = defaultdict(set)
        # User's subscribed rooms: user_id -> set of room_ids
        self.user_rooms: dict[UUID, set[str]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: UUID):
        """Accept a WebSocket connection and register it."""
        await websocket.accept()
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: UUID):
        """Remove a WebSocket connection and clean up subscriptions."""
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
            except ValueError:
                pass

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Remove user from all rooms
                for room_id in list(self.user_rooms.get(user_id, [])):
                    self.leave_room(user_id, room_id)
                if user_id in self.user_rooms:
                    del self.user_rooms[user_id]

        logger.info(f"User {user_id} disconnected. Remaining connections: {len(self.active_connections.get(user_id, []))}")

    def join_room(self, user_id: UUID, room_id: str):
        """Subscribe a user to a room."""
        self.rooms[room_id].add(user_id)
        self.user_rooms[user_id].add(room_id)
        logger.info(f"User {user_id} joined room {room_id}. Room size: {len(self.rooms[room_id])}")

    def leave_room(self, user_id: UUID, room_id: str):
        """Unsubscribe a user from a room."""
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
            if not self.user_rooms[user_id]:
                del self.user_rooms[user_id]

        logger.info(f"User {user_id} left room {room_id}. Room size: {len(self.rooms.get(room_id, []))}")

    async def send_personal_message(self, message: dict[str, Any], user_id: UUID):
        """Send a message to all connections of a specific user."""
        if user_id not in self.active_connections:
            return

        message_str = json.dumps(message)
        dead_connections = []

        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                dead_connections.append(websocket)

        # Clean up dead connections
        for ws in dead_connections:
            self.disconnect(ws, user_id)

    async def broadcast_to_room(self, message: dict[str, Any], room_id: str, exclude_user: UUID | None = None):
        """Broadcast a message to all users in a room."""
        if room_id not in self.rooms:
            return

        message_str = json.dumps(message)
        dead_connections = []

        for user_id in self.rooms[room_id]:
            if exclude_user and user_id == exclude_user:
                continue

            for websocket in self.active_connections.get(user_id, []):
                try:
                    await websocket.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id} in room {room_id}: {e}")
                    dead_connections.append((websocket, user_id))

        # Clean up dead connections
        for ws, uid in dead_connections:
            self.disconnect(ws, uid)

    async def broadcast_to_all(self, message: dict[str, Any]):
        """Broadcast a message to all connected users."""
        message_str = json.dumps(message)
        dead_connections = []

        for user_id, connections in list(self.active_connections.items()):
            for websocket in connections:
                try:
                    await websocket.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    dead_connections.append((websocket, user_id))

        # Clean up dead connections
        for ws, uid in dead_connections:
            self.disconnect(ws, uid)

    def get_room_size(self, room_id: str) -> int:
        """Get the number of users in a room."""
        return len(self.rooms.get(room_id, set()))

    def get_user_rooms(self, user_id: UUID) -> set[str]:
        """Get all rooms a user is subscribed to."""
        return self.user_rooms.get(user_id, set()).copy()


# Global connection manager instance
manager = ConnectionManager()
