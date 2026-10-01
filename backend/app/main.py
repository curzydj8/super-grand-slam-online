"""Super Grand Slam Online · FastAPI 入口。"""
from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, deps, lobby, misc, rank
from .websocket import S_ERROR, make_msg
from .websocket.manager import manager

app = FastAPI(title="Super Grand Slam Online", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产收紧为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(lobby.router)
app.include_router(rank.router)
app.include_router(misc.shop_router)
app.include_router(misc.task_router)
app.include_router(misc.mail_router)
app.include_router(misc.admin_router)


@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "version": "0.1.0"}}


@app.websocket("/ws/{room_id}/{seat}")
async def ws_endpoint(ws: WebSocket, room_id: str, seat: int):
    await ws.accept()
    await manager.join(room_id, seat, ws)
    try:
        while True:
            msg = await ws.receive_json()
            # MVP：回显 + 广播聊天；对局消息由 lobby.py 的 REST 驱动，Phase 2 全量 WS 化
            if msg.get("type") == "ping":
                await ws.send_json(make_msg("pong"))
            elif msg.get("type") == "chat":
                room = manager.get_room(room_id)
                await room.broadcast(make_msg("chat", seat=seat,
                                              text=str(msg.get("text", ""))[:200]))
            else:
                await ws.send_json(make_msg("error", code="not_implemented",
                                            message="Phase 2 实现完整对局 WS 协议"))
    except WebSocketDisconnect:
        await manager.leave(room_id, seat)
