"""排行榜 API：金币榜 / 胜率榜 / 段位榜 / 连胜榜。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import User
from .auth import get_current_user
from .deps import get_db

router = APIRouter(prefix="/api/rank", tags=["rank"])


def _row(u: User, i: int) -> dict:
    rate = round(u.win_count / u.match_count * 100, 1) if u.match_count else 0.0
    return {"rank": i + 1, "uid": u.id, "nickname": u.nickname,
            "level": u.level, "gold": u.gold, "rank_name": u.rank_name,
            "rank_score": u.rank_score, "win_rate": rate,
            "win_streak": u.max_win_streak}


@router.get("/{board}")
def board(board: str,
          limit: int = Query(50, le=100),
          user: User = Depends(get_current_user),
          db: Session = Depends(get_db)):
    q = db.query(User).filter(User.status == 1)
    if board == "gold":
        q = q.order_by(desc(User.gold))
    elif board == "rank":
        q = q.order_by(desc(User.rank_score))
    elif board == "streak":
        q = q.order_by(desc(User.max_win_streak))
    elif board == "winrate":
        users = [u for u in q.all() if u.match_count >= 10]
        users.sort(key=lambda u: u.win_count / u.match_count, reverse=True)
        return {"success": True, "data": [_row(u, i) for i, u in enumerate(users[:limit])]}
    else:
        return {"success": False, "error": "未知榜单"}
    return {"success": True, "data": [_row(u, i) for i, u in enumerate(q.limit(limit).all())]}
