"""
Super Grand Slam Online · AI 出牌决策
====================================
LV1 随机出牌
LV2 保留对子、拆孤张（静态牌效率启发式）
LV3 向听数最小 → 进张数最大（ukeire）
LV4 LV3 + 危险度评估（防守：避开危险牌）+ 副露决策

输入均为 counts（34 位数组）。14 张手牌（摸牌后）选 1 张打出。
"""
from __future__ import annotations

import random

from .mahjong import shanten, ukeire_count, tile_rank


class MahjongAI:
    def __init__(self, level: int = 1, seed: int | None = None):
        assert 1 <= level <= 4
        self.level = level
        self.rng = random.Random(seed)

    # ------------------------------------------------ 对外接口
    def choose_discard(self, counts: list[int], open_melds: int = 0,
                       visible: list[int] | None = None,
                       threats: list[dict] | None = None) -> int:
        """14 张（counts 和为 14 - 3*open_melds）选打出牌。"""
        cands = [t for t in range(34) if counts[t] > 0]
        if self.level == 1:
            return self.rng.choice(cands)
        if self.level == 2:
            return self._lv2(counts, cands)
        if self.level == 3:
            return self._lv3(counts, cands, open_melds, visible)
        return self._lv4(counts, cands, open_melds, visible, threats)

    def decide_pon(self, counts: list[int], tile: int, open_melds: int,
                   yakuhai_tiles: set[int] | None = None) -> bool:
        """是否碰。LV1-2 不碰；LV3+：役牌对必碰，其他看向听不恶化。"""
        if self.level <= 2 or counts[tile] < 2:
            return False
        if yakuhai_tiles and tile in yakuhai_tiles:
            return True
        counts[tile] += 1  # 假设碰后（14张→组面子，少3张暗牌）
        before = shanten(counts, open_melds)
        counts[tile] -= 1
        # 碰后：暗牌少对子+2张，面子+1
        tmp = counts[:]
        tmp[tile] -= 2
        after = shanten(tmp, open_melds + 1)
        return after <= before

    def decide_closed_kan(self, counts: list[int]) -> int | None:
        """暗杠决策：返回可杠的牌，无则 None。LV2+ 有 4 张就杠（简化）。"""
        if self.level <= 1:
            return None
        for t in range(34):
            if counts[t] == 4:
                return t
        return None

    def decide_riichi(self, counts: list[int], open_melds: int,
                      can_riichi: bool = True) -> bool:
        """立直决策：门清听牌 LV3+ 必立直。"""
        return (self.level >= 3 and can_riichi and open_melds == 0
                and shanten(counts, 0) == 0)

    # ------------------------------------------------ LV2
    def _lv2(self, counts: list[int], cands: list[int]) -> int:
        def keep_value(t: int) -> float:
            v = 0.0
            if counts[t] >= 2:
                v += 5
            if t < 27:  # 数牌：邻张价值
                for d in (-2, -1, 1, 2):
                    u = t + d
                    if 0 <= u < 34 and u // 9 == t // 9 and counts[u]:
                        v += 2 if abs(d) == 1 else 1
            else:       # 孤张字牌先打
                v -= 1
            return v
        return min(cands, key=lambda t: (keep_value(t), self.rng.random()))

    # ------------------------------------------------ LV3
    def _lv3(self, counts: list[int], cands: list[int],
             open_melds: int, visible: list[int] | None) -> int:
        # 第一遍：向听数（便宜）；第二遍：仅在最小向听候选中算进张
        scored = []
        for t in cands:
            counts[t] -= 1
            s = shanten(counts, open_melds)
            counts[t] += 1
            scored.append((s, t))
        min_s = min(s for s, _ in scored)
        best, best_key = None, None
        for s, t in scored:
            if s > min_s:
                continue
            u = 0
            if min_s <= 2:
                counts[t] -= 1
                u = ukeire_count(counts, open_melds, visible)
                counts[t] += 1
            key = (-u, self.rng.random())
            if best_key is None or key < best_key:
                best_key, best = key, t
        return best

    # ------------------------------------------------ LV4
    def _lv4(self, counts: list[int], cands: list[int], open_melds: int,
             visible: list[int] | None, threats: list[dict] | None) -> int:
        safe = self._safe_tiles(threats or [])
        scored = []
        for t in cands:
            counts[t] -= 1
            s = shanten(counts, open_melds)
            counts[t] += 1
            scored.append((s, t))
        min_s = min(s for s, _ in scored)
        best, best_key = None, None
        for s, t in scored:
            if s > min_s:
                continue
            u = 0
            if min_s <= 2:
                counts[t] -= 1
                u = ukeire_count(counts, open_melds, visible)
                counts[t] += 1
            danger = 0 if t in safe else self._danger(t, threats or [])
            # 听牌/一向听且危险 → 优先安全
            key = (danger if min_s >= 1 else 0, -u, self.rng.random())
            if best_key is None or key < best_key:
                best_key, best = key, t
        return best

    @staticmethod
    def _safe_tiles(threats: list[dict]) -> set[int]:
        """现物：对手（尤其立直家）打过/自己打过的牌。"""
        safe: set[int] = set()
        for th in threats:
            safe.update(th.get("discards", []))
        return safe

    @staticmethod
    def _danger(t: int, threats: list[dict]) -> int:
        """简化危险度：筋牌/役牌字牌危险。"""
        d = 0
        for th in threats:
            disc = set(th.get("discards", []))
            if t in disc:
                continue
            rt = th.get("riichi_tile")
            if rt is not None and t < 27 and rt < 27 and t // 9 == rt // 9:
                dist = abs(tile_rank(t) - tile_rank(rt))
                d += 2 if dist <= 3 else (1 if dist <= 6 else 0)
            elif t >= 27:
                d += 2
            else:
                d += 1
        return d
