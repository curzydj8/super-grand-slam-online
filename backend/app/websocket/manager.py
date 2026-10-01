"""WebSocket 连接管理：房间、广播、断线重连。"""
from __future__ import annotations

import asyncio
import time

from fastapi import WebSocket


class Room:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.clients: dict[int, WebSocket] = {}   # seat -> ws
        self.lock = asyncio.Lock()
        self.last_active = time.time()

    async def broadcast(self, msg: dict, exclude: int | None = None):
        dead = []
        for seat, ws in self.clients.items():
            if seat == exclude:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(seat)
        for seat in dead:
            self.clients.pop(seat, None)

    async def send_to(self, seat: int, msg: dict):
        ws = self.clients.get(seat)
        if ws:
            await ws.send_json(msg)


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    def get_room(self, room_id: str) -> Room:
        room = self.rooms.get(room_id)
        if room is None:
            room = Room(room_id)
            self.rooms[room_id] = room
        return room

    async def join(self, room_id: str, seat: int, ws: WebSocket):
        room = self.get_room(room_id)
        async with room.lock:
            room.clients[seat] = ws
            room.last_active = time.time()

    async def leave(self, room_id: str, seat: int):
        room = self.rooms.get(room_id)
        if room:
            async with room.lock:
                room.clients.pop(seat, None)
                if not room.clients:
                    self.rooms.pop(room_id, None)


manager = ConnectionManager()
