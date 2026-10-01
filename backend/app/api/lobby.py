"""大厅 / 对局 API。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models import MatchRecord, User
from ..services.game import MatchService
from .auth import get_current_user
from .deps import get_db

router = APIRouter(prefix="/api", tags=["lobby"])

# MVP：内存对局（生产应放 Redis）。key: room_id
_matches: dict[str, MatchService] = {}


class CreateMatchIn(BaseModel):
    mode: str = "ai"        # ai=单机AI
    ai_level: int = 2       # 1-4


@router.post("/match/create")
def create_match(body: CreateMatchIn, user: User = Depends(get_current_user)):
    svc = MatchService(user.id, user.nickname, ai_level=body.ai_level)
    svc.start_round()
    _matches[svc.room_id] = svc
    me = svc.players[0]
    return {"success": True, "data": {
        "room_id": svc.room_id,
        "hand": me.hand,
        "dealer": 0,
        "round": svc.round,
        "scores": svc.scores(),
    }}


@router.get("/match/{room_id}/state")
def match_state(room_id: str, user: User = Depends(get_current_user)):
    svc = _matches.get(room_id)
    if not svc:
        return {"success": False, "error": "房间不存在"}
    me = svc.players[0]
    return {"success": True, "data": {
        "hand": me.hand,
        "melds": [{"kind": m.kind, "tiles": m.tiles} for m in me.melds],
        "discards": [p.discards for p in svc.players],
        "scores": svc.scores(),
        "turn": svc.turn,
        "round": svc.round,
        "riichi": [p.riichi for p in svc.players],
    }}


@router.post("/match/{room_id}/discard")
def discard(room_id: str, body: dict, user: User = Depends(get_current_user),
            db: Session = Depends(get_db)):
    svc = _matches.get(room_id)
    if not svc:
        return {"success": False, "error": "房间不存在"}
    tile = int(body["tile"])
    # 玩家摸牌（如刚开局庄家首巡）
    if len(svc.players[0].hand) % 3 == 1:
        svc.draw(0)
    events = svc.discard(0, tile)
    # AI 依次行动（简化：三家各摸打一次）
    for seat in (1, 2, 3):
        ev = svc.ai_turn(seat)
        events[f"ai_{seat}"] = ev
        if "tsumo" in ev:
            result = svc.apply_tsumo(seat, _FakeResult(ev["tsumo"]))
            events["match_event"] = {"type": "tsumo", **result}
            break
    # 玩家补摸
    drawn = svc.draw(0)
    events["draw"] = drawn
    return {"success": True, "data": events}


class _FakeResult:
    def __init__(self, tsumo_ev: dict):
        self.score = tsumo_ev["score"]
        self.yaku = tsumo_ev["yaku"]
        self.han = sum(h for _, h in self.yaku)
        self.fu = 0


@router.get("/records")
def records(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(MatchRecord).filter(
        MatchRecord.players.contains(str(user.id))).order_by(
        MatchRecord.id.desc()).limit(20).all()
    return {"success": True, "data": [
        {"id": r.id, "room_id": r.room_id, "mode": r.mode, "players": r.players,
         "winner": r.winner, "score": r.score,
         "start_time": r.start_time.isoformat() if r.start_time else None,
         "end_time": r.end_time.isoformat() if r.end_time else None}
        for r in rows]}
