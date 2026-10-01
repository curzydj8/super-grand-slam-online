"""对局服务：单机 AI 对局流程（MVP）。多人匹配对局复用同一状态机，待 Phase 2。"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field

from ..core.mahjong import (
    EAST, SOUTH, WEST, NORTH, Meld, WinContext,
    check_agari, counts_of, create_wall, deal, is_winning, shanten,
)
from ..core.ai import MahjongAI

AI_NAMES = ["东条", "南浦", "西门"]


@dataclass
class PlayerState:
    uid: int
    nickname: str
    seat: int                      # 0=东(庄家首局) 1=南 2=西 3=北
    hand: list[int] = field(default_factory=list)   # 暗牌（counts 形式之外另存列表用于展示）
    counts: list[int] = field(default_factory=lambda: [0] * 34)
    melds: list[Meld] = field(default_factory=list)
    discards: list[int] = field(default_factory=list)
    score: int = 25000
    riichi: bool = False
    is_ai: bool = False
    ai: MahjongAI | None = None


class MatchService:
    """一局半庄（8 局）的最小可玩状态机。"""

    def __init__(self, uid: int, nickname: str, ai_level: int = 2, seed: int | None = None):
        self.room_id = f"ai-{uuid.uuid4().hex[:8]}"
        self.rng = random.Random(seed)
        self.round = 0            # 0-7: 东1-东4, 南1-南4
        self.honba = 0
        self.riichi_sticks: list[int] = []   # 供托
        self.players = [PlayerState(uid, nickname, 0)]
        for i, name in enumerate(AI_NAMES, start=1):
            self.players.append(PlayerState(-i, f"AI·{name}", i,
                                            is_ai=True, ai=MahjongAI(ai_level, seed)))
        self.wall: list[int] = []
        self.dead_wall: list[int] = []
        self.turn = 0
        self.round_wind = EAST
        self.winner_log: list[dict] = []

    # ---------------- 开局 ----------------
    def start_round(self):
        wall = create_wall()
        hands, rest = deal(wall)
        self.dead_wall = rest[-14:]
        self.wall = rest[:-14]
        self.round_wind = EAST if self.round < 4 else SOUTH
        for p, h in zip(self.players, hands):
            p.hand = sorted(h)
            p.counts = counts_of(h)
            p.melds = []
            p.discards = []
            p.riichi = False
        self.turn = self.round % 4  # 简化：按局数轮庄，实际应按连庄规则

    # ---------------- 摸牌 ----------------
    def draw(self, seat: int) -> int | None:
        if not self.wall:
            return None
        t = self.wall.pop(0)
        p = self.players[seat]
        p.counts[t] += 1
        p.hand.append(t)
        p.hand.sort()
        return t

    # ---------------- 出牌 ----------------
    def discard(self, seat: int, tile: int) -> dict:
        p = self.players[seat]
        assert p.counts[tile] > 0, "手牌没有这张牌"
        p.counts[tile] -= 1
        p.hand.remove(tile)
        p.discards.append(tile)
        events: dict = {"discard": {"seat": seat, "tile": tile}}
        # 检查他家荣和
        for i, q in enumerate(self.players):
            if i != seat and self._can_ron(q, tile):
                events["ron_available"] = {"seat": i}
        return events

    def _can_ron(self, p: PlayerState, tile: int) -> bool:
        ctx = WinContext(tsumo=False, round_wind=self.round_wind,
                         seat_wind=[EAST, SOUTH, WEST, NORTH][p.seat])
        r = check_agari(p.counts, p.melds, tile, ctx, dealer=(p.seat == 0))
        return r is not None

    # ---------------- AI 行动 ----------------
    def ai_turn(self, seat: int) -> dict:
        p = self.players[seat]
        t = self.draw(seat)
        if t is None:
            return {"exhaustive": True}
        # 自摸检查
        ctx = WinContext(tsumo=True, round_wind=self.round_wind,
                         seat_wind=[EAST, SOUTH, WEST, NORTH][p.seat])
        r = check_agari(p.counts, p.melds, t, ctx, dealer=(p.seat == 0))
        if r is not None:
            return {"tsumo": {"seat": seat, "yaku": r.yaku, "score": r.score}}
        # 立直检查
        if p.ai.decide_riichi(p.counts, len([m for m in p.melds if not m.concealed])):
            p.riichi = True
        visible = [d for q in self.players for d in q.discards]
        d = p.ai.choose_discard(p.counts, len(p.melds), visible)
        ev = self.discard(seat, d)
        ev["draw"] = t
        return ev

    # ---------------- 结算 ----------------
    def apply_tsumo(self, seat: int, result) -> dict:
        pays = result.score["payments"]
        winner = self.players[seat]
        total = 0
        for i, pay in enumerate(pays):
            # payments 顺序：[亲家, 闲家, 闲家]（子家自摸）或三家均摊（亲家自摸）
            oseat = (seat + 1 + i) % 4
            self.players[oseat].score -= pay
            total += pay
        winner.score += total + 1000 * len(self.riichi_sticks)
        self.riichi_sticks = []
        self.winner_log.append({"round": self.round, "winner": seat,
                                "yaku": result.yaku, "han": result.han,
                                "fu": result.fu, "score": total})
        return {"winner": seat, "score": total, "yaku": result.yaku}

    def scores(self) -> list[dict]:
        return [{"uid": p.uid, "nickname": p.nickname,
                 "seat": p.seat, "score": p.score} for p in self.players]
