from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._order_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect_order(self, order_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._order_connections[order_id].add(websocket)

    async def connect_user(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_connections[user_id].add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            for connections in self._order_connections.values():
                connections.discard(websocket)
            for connections in self._user_connections.values():
                connections.discard(websocket)

    async def broadcast_order(self, order_id: int, payload: dict[str, Any]) -> None:
        await self._broadcast(self._order_connections.get(order_id, set()), payload)

    async def broadcast_users(self, user_ids: list[int], payload: dict[str, Any]) -> None:
        sockets: set[WebSocket] = set()
        for user_id in user_ids:
            sockets.update(self._user_connections.get(user_id, set()))
        await self._broadcast(sockets, payload)

    async def _broadcast(self, sockets: set[WebSocket], payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for socket in list(sockets):
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        if stale:
            async with self._lock:
                for socket in stale:
                    for connections in self._order_connections.values():
                        connections.discard(socket)
                    for connections in self._user_connections.values():
                        connections.discard(socket)


realtime_hub = RealtimeHub()
