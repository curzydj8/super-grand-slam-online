"""
Super Grand Slam Online · 麻将核心逻辑
=====================================
实现 docs/rules.md 定义的全部核心算法：

- 牌编码 0-33（0-8 万 / 9-17 筒 / 18-26 条 / 27-30 东南西北 / 31-33 白发中）
- Fisher-Yates 洗牌、发牌（庄家14/闲家13）
- 胡牌判定（标准形 / 七对子 / 国士无双）
- 向听数（标准形 / 七对子 / 国士，取最小）
- 番种判定（MVP 番种表）
- 符数与得点计算

纯函数模块，无外部依赖，可直接单元测试。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

# ------------------------------------------------ 牌编码
MAN, PIN, SOU = 0, 9, 18          # 万 / 筒 / 条起始
EAST, SOUTH, WEST, NORTH = 27, 28, 29, 30
HAKU, HATSU, CHUN = 31, 32, 33   # 白 / 发 / 中

TERMINALS_HONORS = [0, 8, 9, 17, 18, 26] + list(range(27, 34))  # 幺九牌


def is_suited(t: int) -> bool:
    return t < 27


def tile_rank(t: int) -> int:
    """0-8 牌面点数（仅数牌有意义）"""
    return t % 9


def is_terminal_or_honor(t: int) -> bool:
    return t in TERMINALS_HONORS


def counts_of(tiles: list[int]) -> list[int]:
    c = [0] * 34
    for t in tiles:
        c[t] += 1
    return c


# ------------------------------------------------ 洗牌 / 发牌
def create_wall(seed: int | None = None) -> list[int]:
    """136 张牌墙，Fisher-Yates Shuffle"""
    wall = [t for t in range(34) for _ in range(4)]
    rng = random.Random(seed)
    for i in range(len(wall) - 1, 0, -1):
        j = rng.randrange(i + 1)
        wall[i], wall[j] = wall[j], wall[i]
    return wall


def deal(wall: list[int]) -> tuple[list[list[int]], list[int]]:
    """发牌：4-4-4-1 轮切，庄家(0) 14 张、闲家 13 张。返回 (hands, 剩余牌墙)。"""
    hands = [[] for _ in range(4)]
    idx = 0
    for _ in range(3):
        for p in range(4):
            hands[p].extend(wall[idx:idx + 4])
            idx += 4
    for p in range(4):
        hands[p].append(wall[idx])
        idx += 1
    hands[0].append(wall[idx])  # 庄家多 1 张
    idx += 1
    for h in hands:
        h.sort()
    return hands, wall[idx:]


# ------------------------------------------------ 胡牌判定
@dataclass
class Meld:
    kind: str            # 'chi' | 'pon' | 'open_kan' | 'closed_kan'
    tiles: list[int]     # 组成牌
    concealed: bool = False


@dataclass
class WinDecomposition:
    """一种和牌拆分"""
    pair: int
    melds: list[list[int]]          # 暗面子拆分（每组为牌列表）
    open_melds: list[Meld] = field(default_factory=list)


def _decompose_melds(counts: list[int], need: int) -> list[list[list[int]]]:
    """把 counts 拆成 need 组面子，返回所有拆法。"""
    for t in range(34):
        if counts[t]:
            break
    else:
        return [[]] if need == 0 else []
    if need <= 0:
        return []
    out: list[list[list[int]]] = []
    # 刻子
    if counts[t] >= 3:
        counts[t] -= 3
        for rest in _decompose_melds(counts, need - 1):
            out.append([[t, t, t]] + rest)
        counts[t] += 3
    # 顺子
    if t < 27 and tile_rank(t) <= 6 and counts[t + 1] and counts[t + 2]:
        counts[t] -= 1
        counts[t + 1] -= 1
        counts[t + 2] -= 1
        for rest in _decompose_melds(counts, need - 1):
            out.append([[t, t + 1, t + 2]] + rest)
        counts[t] += 1
        counts[t + 1] += 1
        counts[t + 2] += 1
    return out


def decompose_standard(counts: list[int], open_melds: int = 0) -> list[WinDecomposition]:
    """标准形拆分：counts 为暗牌，返回所有 (雀头 + 面子) 拆法。"""
    need = 4 - open_melds
    if need < 0:
        return []
    c = counts[:]
    out: list[WinDecomposition] = []
    for p in range(34):
        if c[p] >= 2:
            c[p] -= 2
            for melds in _decompose_melds(c, need):
                out.append(WinDecomposition(pair=p, melds=melds))
            c[p] += 2
    return out


def is_chiitoi(counts: list[int]) -> bool:
    """七对子：7 种对子，无 4 张同牌"""
    return sum(1 for c in counts if c == 2) == 7 and all(c <= 2 for c in counts)


def is_kokushi(counts: list[int]) -> bool:
    """国士无双：13 种幺九各 ≥1，其中一种成对"""
    kinds = sum(1 for t in TERMINALS_HONORS if counts[t] >= 1)
    pair = any(counts[t] >= 2 for t in TERMINALS_HONORS)
    others = sum(counts[t] for t in range(34) if t not in TERMINALS_HONORS)
    return kinds == 13 and pair and others == 0


def is_winning(counts: list[int], open_melds: int = 0) -> bool:
    c = counts[:]
    if open_melds == 0 and (is_chiitoi(c) or is_kokushi(c)):
        return True
    return bool(decompose_standard(c, open_melds))


# ------------------------------------------------ 向听数
def _shanten_standard(counts: list[int], open_melds: int = 0) -> int:
    best = 8
    c = counts[:]

    def leaf(melds: int, taatsu: int, pair: bool) -> None:
        nonlocal best
        m = melds + open_melds
        t = taatsu
        if m > 4:
            m = 4
        if m + t > 4:
            t = 4 - m
        s = 8 - 2 * m - t - (1 if pair else 0)
        if s < best:
            best = s

    def dfs(pos: int, melds: int, taatsu: int, pair: bool) -> None:
        while pos < 34 and c[pos] == 0:
            pos += 1
        if pos >= 34:
            leaf(melds, taatsu, pair)
            return
        n = c[pos]
        # 刻子
        if n >= 3:
            c[pos] -= 3
            dfs(pos, melds + 1, taatsu, pair)
            c[pos] += 3
        # 顺子
        r = tile_rank(pos)
        if pos < 27 and r <= 6 and c[pos + 1] and c[pos + 2]:
            c[pos] -= 1
            c[pos + 1] -= 1
            c[pos + 2] -= 1
            dfs(pos, melds + 1, taatsu, pair)
            c[pos] += 1
            c[pos + 1] += 1
            c[pos + 2] += 1
        # 对子（雀头候选 / 多余对子作搭子）
        if n >= 2:
            c[pos] -= 2
            if pair:
                dfs(pos, melds, taatsu + 1, pair)
            else:
                dfs(pos, melds, taatsu, True)
            c[pos] += 2
        # 两面搭子
        if pos < 27 and r <= 7 and c[pos + 1]:
            c[pos] -= 1
            c[pos + 1] -= 1
            dfs(pos, melds, taatsu + 1, pair)
            c[pos] += 1
            c[pos + 1] += 1
        # 嵌张搭子
        if pos < 27 and r <= 6 and c[pos + 2]:
            c[pos] -= 1
            c[pos + 2] -= 1
            dfs(pos, melds, taatsu + 1, pair)
            c[pos] += 1
            c[pos + 2] += 1
        # 扔掉这张
        c[pos] -= 1
        dfs(pos + 1, melds, taatsu, pair)
        c[pos] += 1

    dfs(0, 0, 0, False)
    return best


def _shanten_chiitoi(counts: list[int]) -> int:
    """七对子向听数（精确）：need=缺的对子数；单张转对 1 步，凭空造对 2 步。"""
    pairs = sum(1 for x in counts if x >= 2)
    singles = sum(1 for x in counts if x == 1)
    need = max(0, 6 - pairs)
    use_singles = min(singles, need)
    return use_singles + 2 * (need - use_singles)


def _shanten_kokushi(counts: list[int]) -> int:
    kinds = sum(1 for t in TERMINALS_HONORS if counts[t] >= 1)
    pair = 1 if any(counts[t] >= 2 for t in TERMINALS_HONORS) else 0
    return 13 - kinds - pair


def shanten(counts: list[int], open_melds: int = 0) -> int:
    """向听数：-1=已胡，0=听牌。副露时不计七对/国士形。"""
    s = _shanten_standard(counts, open_melds)
    if open_melds == 0:
        s = min(s, _shanten_chiitoi(counts), _shanten_kokushi(counts))
    return s


# ------------------------------------------------ 番种判定
@dataclass
class WinContext:
    tsumo: bool = False
    riichi: bool = False          # 立直
    double_riichi: bool = False   # 双立直
    ippatsu: bool = False         # 一发
    round_wind: int = EAST
    seat_wind: int = EAST
    haitei: bool = False          # 海底摸月
    houtei: bool = False          # 河底捞鱼
    rinshan: bool = False         # 岭上开花
    chankan: bool = False         # 抢杠
    dora_indicators: list[int] = field(default_factory=list)


def _dora_tile(ind: int) -> int:
    if ind < 27:
        return ind // 9 * 9 + (tile_rank(ind) + 1) % 9
    if ind < 31:
        return 27 + (ind - 27 + 1) % 4
    return 31 + (ind - 31 + 1) % 3


def _all_tiles(counts: list[int], melds: list[Meld]) -> list[int]:
    tiles: list[int] = []
    for t, n in enumerate(counts):
        tiles.extend([t] * n)
    for m in melds:
        tiles.extend(m.tiles)
    return tiles


def detect_yaku(counts: list[int], melds: list[Meld], win_tile: int,
                ctx: WinContext, decomp: WinDecomposition | None = None) -> list[tuple[str, int]]:
    """返回 [(番种名, 翻数)]。无番返回 []（不可和）。"""
    yaku: list[tuple[str, int]] = []
    menzen = not melds or all(m.concealed for m in melds)
    tiles = _all_tiles(counts, melds)

    # ---- 役满先行 ----
    if is_kokushi(counts):
        return [("国士无双", 13)]
    if decomp is None:
        # 七对子形：只计七对子 + 形势役，不与标准形番种复合
        if is_chiitoi(counts):
            yaku.append(("七对子", 2))
    else:
        all_melds = decomp.melds + [m.tiles for m in melds]
        pair = decomp.pair
        is_all_chi = all(len(sorted(set(m))) == 3 and m[0] < 27 and m[2] - m[0] == 2
                         for m in decomp.melds)
        is_all_pon = all(len(set(m)) == 1 for m in decomp.melds)

        def yakuhai(t: int) -> bool:
            return t in (HAKU, HATSU, CHUN) or t == ctx.seat_wind or t == ctx.round_wind

        # 役牌刻子
        for m in all_melds:
            if len(set(m)) == 1:
                t = m[0]
                if t == HAKU:
                    yaku.append(("役牌·白", 1))
                elif t == HATSU:
                    yaku.append(("役牌·發", 1))
                elif t == CHUN:
                    yaku.append(("役牌·中", 1))
                elif t == ctx.seat_wind and t == ctx.round_wind:
                    yaku.append(("役牌·连风刻", 2))
                elif t == ctx.seat_wind:
                    yaku.append(("役牌·自风", 1))
                elif t == ctx.round_wind:
                    yaku.append(("役牌·场风", 1))

        # 断幺九
        if all(not is_terminal_or_honor(t) for t in tiles):
            yaku.append(("断幺九", 1))
        # 混一色 / 清一色
        suits = {t // 9 for t in tiles if t < 27}
        has_honor = any(t >= 27 for t in tiles)
        if len(suits) == 1 and not has_honor:
            yaku.append(("清一色", 5 if not menzen else 6))
        elif len(suits) == 1 and has_honor:
            yaku.append(("混一色", 2 if not menzen else 3))
        # 对对和 / 混老头
        if is_all_pon:
            yaku.append(("对对和", 2))
            if all(is_terminal_or_honor(t) for t in tiles):
                yaku.append(("混老头", 2))
        # 一气通贯 / 三色同顺 / 三色同刻
        chi_sets = {}
        for m in decomp.melds:
            if len(set(m)) == 3 and m[0] < 27:
                chi_sets.setdefault(m[0] // 9, []).append(tile_rank(m[0]))
        for suit, starts in chi_sets.items():
            s = set(starts)
            if {0, 3, 6} <= s:
                yaku.append(("一气通贯", 1 if not menzen else 2))
        for r in range(7):
            if all(r in chi_sets.get(s, []) for s in range(3)):
                yaku.append(("三色同顺", 1 if not menzen else 2))
        pon_ranks: dict[int, set[int]] = {}
        for m in all_melds:
            if len(set(m)) == 1 and m[0] < 27:
                pon_ranks.setdefault(tile_rank(m[0]), set()).add(m[0] // 9)
        for r, ss in pon_ranks.items():
            if len(ss) == 3:
                yaku.append(("三色同刻", 2))
        # 全带幺九：全部面子带幺九 且 雀头为幺九
        def has_terminal(m: list[int]) -> bool:
            return any(is_terminal_or_honor(t) for t in m)
        if all(has_terminal(m) for m in all_melds) and is_terminal_or_honor(pair):
            if not has_honor:
                yaku.append(("纯全带幺九", 2 if not menzen else 3))
            else:
                yaku.append(("混全带幺九", 1 if not menzen else 2))
        # 三暗刻 / 三杠子 / 小三元
        concealed_pon = sum(1 for m in decomp.melds if len(set(m)) == 1) + \
            sum(1 for m in melds if m.kind == 'closed_kan')
        if concealed_pon >= 3:
            yaku.append(("三暗刻", 2))
        kans = sum(1 for m in melds if 'kan' in m.kind)
        if kans >= 3:
            yaku.append(("三杠子", 2))
        sangen = [t for t in (HAKU, HATSU, CHUN)]
        pon_sangen = sum(1 for t in sangen if any(len(set(m)) == 1 and m[0] == t for m in all_melds))
        if pon_sangen == 2 and pair in sangen:
            yaku.append(("小三元", 2))
        if pon_sangen == 3:
            return [("大三元", 13)]
        # 平和 / 一盃口 / 二盃口（门清限定）
        if menzen and is_all_chi and not yakuhai(pair):
            # 平和：和了牌须以两面形完成顺子（自摸同理；单骑/嵌张/边张不成平和）
            win_meld = next((m for m in decomp.melds if win_tile in m), None)
            pinfu = False
            if win_meld is not None:
                a = sorted(win_meld)[0]
                r = tile_rank(a)
                mid = sorted(win_meld)[1]
                if mid == win_tile:
                    pinfu = False          # 嵌张
                elif win_tile == a:
                    pinfu = r >= 1         # 边张听 1/9 则非平和
                else:                      # win_tile == a + 2
                    pinfu = r <= 5
            if pinfu:
                yaku.append(("平和", 1))
            seqs = sorted(tuple(sorted(m)) for m in decomp.melds)
            if seqs[0] == seqs[1] and seqs[2] == seqs[3]:
                yaku.append(("二盃口", 3))
            elif seqs[0] == seqs[1] or seqs[1] == seqs[2] or seqs[2] == seqs[3]:
                yaku.append(("一盃口", 1))

    # ---- 形势役 ----
    if ctx.tsumo and menzen:
        yaku.append(("门前清自摸和", 1))
    if ctx.double_riichi:
        yaku.append(("双立直", 2))
    elif ctx.riichi:
        yaku.append(("立直", 1))
    if ctx.ippatsu:
        yaku.append(("一发", 1))
    if ctx.rinshan:
        yaku.append(("岭上开花", 1))
    if ctx.chankan:
        yaku.append(("抢杠", 1))
    if ctx.haitei:
        yaku.append(("海底摸月", 1))
    if ctx.houtei:
        yaku.append(("河底捞鱼", 1))

    # 宝牌
    dora = 0
    for ind in ctx.dora_indicators:
        d = _dora_tile(ind)
        dora += tiles.count(d)
    if dora:
        yaku.append(("宝牌", dora))
    return yaku


# ------------------------------------------------ 符数与得点
def _wait_fu(decomp: WinDecomposition, win_tile: int, tsumo: bool) -> tuple[int, bool]:
    """返回 (听牌形附加符, 是否两面听)。"""
    if decomp.pair == win_tile:
        return 2, False  # 单骑
    for m in decomp.melds:
        if win_tile in m:
            s = sorted(m)
            if len(set(s)) == 1:
                return 2, False  # 双碰（ expanded: 视为单骑类）
            a = s[0]
            r = tile_rank(a)
            if s[1] == win_tile:
                return 2, False  # 嵌张
            if win_tile == a:
                return (0, True) if r >= 1 else (2, False)  # 两面 / 边张
            if win_tile == s[2]:
                return (0, True) if r <= 5 else (2, False)
    return 0, True


def calculate_fu(counts: list[int], melds: list[Meld], win_tile: int,
                 ctx: WinContext, decomp: WinDecomposition | None,
                 yaku_names: list[str]) -> int:
    if is_chiitoi(counts):
        return 25
    menzen = not melds or all(m.concealed for m in melds)
    fu = 20
    if not ctx.tsumo and menzen:
        fu += 10  # 门清荣和
    if ctx.tsumo and "平和" not in yaku_names:
        fu += 2
    # 雀头
    if decomp is not None:
        p = decomp.pair
        if p in (HAKU, HATSU, CHUN):
            fu += 2
        if p == ctx.seat_wind:
            fu += 2
        if p == ctx.round_wind:
            fu += 2
        # 面子
        for m in decomp.melds:
            tiles_m = sorted(m)
            if len(set(tiles_m)) == 1:
                t = tiles_m[0]
                fu += 4 if not is_terminal_or_honor(t) else 16  # 暗刻
        for m in melds:
            t = m.tiles[0]
            term = is_terminal_or_honor(t)
            if m.kind == 'pon':
                fu += 8 if term else 2
            elif m.kind == 'open_kan':
                fu += 32 if term else 8
            elif m.kind == 'closed_kan':
                fu += 64 if term else 16
        # 听牌形
        wfu, _ = _wait_fu(decomp, win_tile, ctx.tsumo)
        # 双碰：win_tile 完成刻子且手牌另有对子 → 按单骑计已在上式
        fu += wfu
    # 向上取十
    return ((fu + 9) // 10) * 10


def _round_up_100(n: int) -> int:
    return ((n + 99) // 100) * 100


def calculate_score(han: int, fu: int, tsumo: bool, dealer: bool) -> dict:
    """返回 {'total', 'payments'}。payments: 荣和 [放铳者支付]；自摸 [上家, 对家, 下家] 相对顺序简化为 [亲, 子, 子] 或均摊。"""
    if han >= 13:
        base = 8000
    elif han >= 11:
        base = 6000
    elif han >= 8:
        base = 4000
    elif han >= 6:
        base = 3000
    elif han >= 5 or (han == 4 and fu >= 40) or (han == 3 and fu >= 70):
        base = 2000
    else:
        base = fu * (2 ** (han + 2))
    if tsumo:
        if dealer:
            pay = _round_up_100(base * 2)
            return {"total": pay * 3, "payments": [pay, pay, pay], "base": base}
        pay_dealer = _round_up_100(base * 2)
        pay_other = _round_up_100(base)
        return {"total": pay_dealer + pay_other * 2,
                "payments": [pay_dealer, pay_other, pay_other], "base": base}
    mult = 6 if dealer else 4
    total = _round_up_100(base * mult)
    return {"total": total, "payments": [total], "base": base}


@dataclass
class AgariResult:
    yaku: list[tuple[str, int]]
    han: int
    fu: int
    score: dict
    decomp: WinDecomposition | None


def check_agari(counts: list[int], melds: list[Meld], win_tile: int,
                ctx: WinContext, dealer: bool) -> AgariResult | None:
    """和了判定总入口：返回 None 表示无役不可和。"""
    c = counts[:]
    c[win_tile] += 1
    open_n = sum(1 for m in melds if not m.concealed)
    best: AgariResult | None = None

    candidates: list[WinDecomposition | None] = []
    c14 = sum(c)
    if open_n == 0 and is_chiitoi(c):
        candidates.append(None)          # 七对子形
    if open_n == 0 and is_kokushi(c):
        candidates.append(None)          # 国士形
    # 标准形（七对子手牌也可能拆出二盃口等标准形，取最高打点）
    candidates.extend(decompose_standard(c, len(melds)))
    _ = c14

    for decomp in candidates:
        yaku = detect_yaku(c, melds, win_tile, ctx, decomp)
        han = sum(h for _, h in yaku)
        if han <= 0:
            continue
        names = [n for n, _ in yaku]
        fu = calculate_fu(c, melds, win_tile, ctx, decomp, names)
        score = calculate_score(han, fu, ctx.tsumo, dealer)
        if best is None or (han, score["total"]) > (best.han, best.score["total"]):
            best = AgariResult(yaku=yaku, han=han, fu=fu, score=score, decomp=decomp)
    return best


# ------------------------------------------------ 便捷：有效进张（AI 用）
def ukeire_count(counts: list[int], open_melds: int = 0,
                 visible: list[int] | None = None) -> int:
    """当前手牌的进张数（摸到即提升向听的牌剩余张数）。"""
    cur = shanten(counts, open_melds)
    if cur < 0:
        return 0
    used = counts[:]
    if visible:
        for t in visible:
            used[t] += 1
    total = 0
    for t in range(34):
        if used[t] >= 4:
            continue
        used[t] += 1
        if shanten(used, open_melds) < cur:
            total += 4 - used[t]
        used[t] -= 1
    return total
