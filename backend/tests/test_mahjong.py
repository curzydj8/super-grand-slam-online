"""mahjong.py 单元测试：已知牌例验证胡牌/番种/符点数/向听数。"""
import sys, time
sys.path.insert(0, "/home/hatch/workspace/super-grand-slam-online/backend/app")
from core import mahjong as M


def parse(s: str) -> list[int]:
    counts = [0] * 34
    num = ""
    for ch in s:
        if ch.isdigit():
            num += ch
        else:
            base = {"m": 0, "p": 9, "s": 18, "z": 27}[ch]
            for d in num:
                counts[base + int(d) - 1] += 1
            num = ""
    return counts


def tile(s: str) -> int:
    base = {"m": 0, "p": 9, "s": 18, "z": 27}[s[1]]
    return base + int(s[0]) - 1


passed = failed = 0
def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {extra}")


print("== 洗牌/发牌 ==")
w1 = M.create_wall(seed=42)
w2 = M.create_wall(seed=42)
check("136张", len(w1) == 136)
check("每种4张", all(w1.count(t) == 4 for t in range(34)))
check("seed确定性", w1 == w2)
check("Fisher-Yates打乱", w1 != sorted(w1))
hands, rest = M.deal(w1)
check("庄家14张", len(hands[0]) == 14)
check("闲家13张", all(len(h) == 13 for h in hands[1:]))
check("剩余牌墙", len(rest) == 136 - 14 - 13 * 3 == 83)

print("== 胡牌判定 ==")
check("标准形", M.is_winning(parse("123m456m789p111z22s")))
check("非胡", not M.is_winning(parse("123m456m789p112z23s")))
check("七对子", M.is_winning(parse("112233m445566p77s")))
check("七对子拒绝4张", not M.is_chiitoi(parse("1111m223344p55s")))
check("国士无双", M.is_winning(parse("19m19p19s1234567z1m")))
check("副露标准形", M.is_winning(parse("123m456m77p"), open_melds=2))

print("== 向听数 ==")
check("听牌=0", M.shanten(parse("123m456m789p11s23s")) == 0)
check("2向听", M.shanten(parse("123m45m12p345s5z6z7z")) == 2)
check("国士听牌=0", M.shanten(parse("19m19p19s123456z6z")) == 0)
check("七对子6对=0", M.shanten(parse("1122m3344p5566s7z")) == 0)
check("已胡=-1", M.shanten(parse("123m456m789p111z22s")) == -1)
check("副露听牌", M.shanten(parse("123m456m78p"), open_melds=2) == 0)
# 随机手牌不崩溃 + 性能
t0 = time.time()
for i in range(200):
    M.shanten(parse("".join(f"{(i*7+j*13)%9+1}m" for j in range(13))))
dt = time.time() - t0
check(f"200次向听<2s ({dt:.2f}s)", dt < 2.0)

print("== 番种/符/点数 ==")
ctx = M.WinContext(tsumo=True, round_wind=M.EAST, seat_wind=M.EAST)
# A: 234m567m345p67p55s + 8p自摸 → 平和+断幺九+自摸 = 3翻20符
r = M.check_agari(parse("234m567m345p67p55s"), [], tile("8p"), ctx, dealer=False)
names = [n for n, _ in r.yaku]
check("A 平和", "平和" in names, names)
check("A 断幺九", "断幺九" in names, names)
check("A 自摸", "门前清自摸和" in names, names)
check("A 3翻", r.han == 3, f"han={r.han}")
check("A 20符(平和自摸)", r.fu == 20, f"fu={r.fu}")
# 3翻20符 子自摸: base=640 → 亲1300/子700
check("A 点数2700", r.score["total"] == 2700, r.score)

# A2: 同形单骑听 → 非平和（验证tanki排除）
r2 = M.check_agari(parse("234m567m345p678s5s"), [], tile("5s"), ctx, dealer=False)
names2 = [n for n, _ in r2.yaku]
check("A2 单骑非平和", "平和" not in names2, names2)

# B: 234m567m345p22s111z + 1z荣和 → 役牌白 1翻50符 子荣和1600
ctxB = M.WinContext(tsumo=False, round_wind=M.EAST, seat_wind=M.SOUTH)
rB = M.check_agari(parse("234m567m345p22s55z"), [], tile("5z"), ctxB, dealer=False)
namesB = [n for n, _ in rB.yaku]
check("B 役牌白", namesB == ["役牌·白"], namesB)
check("B 1翻", rB.han == 1)
check("B 50符", rB.fu == 50, f"fu={rB.fu}")
check("B 1600点", rB.score["total"] == 1600, rB.score)

# C: 清一色 123m456m789m111m2m + 2m自摸 → 清一色6+自摸1=7翻 跳满
rC = M.check_agari(parse("123m456m789m111m2m"), [], tile("2m"), ctx, dealer=False)
namesC = [n for n, _ in rC.yaku]
check("C 清一色", "清一色" in namesC, namesC)
check("C 清一色+一气通贯9翻", rC.han == 9, f"han={rC.han} {namesC}")
check("C 倍满16000", rC.score["total"] == 16000, rC.score)

# D: 国士 13种幺九 + 1m荣和 → 役满32000
ctxD = M.WinContext(tsumo=False)
rD = M.check_agari(parse("19m19p19s1234567z"), [], tile("1m"), ctxD, dealer=False)
check("D 国士无双", rD.yaku == [("国士无双", 13)], rD.yaku)
check("D 32000", rD.score["total"] == 32000, rD.score)

# E: 七对子 112233m445566p7s + 7s荣和 → 2翻25符 1600
rE = M.check_agari(parse("113355m224466p7s"), [], tile("7s"), ctxB, dealer=False)
namesE = [n for n, _ in rE.yaku]
check("E 七对子", "七对子" in namesE, namesE)
check("E 25符", rE.fu == 25, f"fu={rE.fu}")
check("E 1600点", rE.score["total"] == 1600, rE.score)

# F: 无役不可和（全顺子但无役：白板雀头非役牌？用 234m567m234p567p11z + 听... ）
rF = M.check_agari(parse("234m567m234p56p11z"), [], tile("7p"),
                   M.WinContext(tsumo=False, round_wind=M.EAST, seat_wind=M.EAST), dealer=False)
check("F 无役不可和", rF is None or rF.han == 0, rF and rF.yaku)

# G: 立直+一发+平和+断幺九+自摸 = 5翻 → 满贯
ctxG = M.WinContext(tsumo=True, riichi=True, ippatsu=True, round_wind=M.EAST, seat_wind=M.EAST)
rG = M.check_agari(parse("234m567m345p67p55s"), [], tile("8p"), ctxG, dealer=False)
check("G 5翻", rG.han == 5, f"han={rG.han} {[n for n,_ in rG.yaku]}")
check("G 满贯8000", rG.score["total"] == 8000, rG.score)

print("== 点数公式 ==")
check("3翻40符子荣和5200", M.calculate_score(3, 40, False, False)["total"] == 5200)
check("1翻30符子荣和1000", M.calculate_score(1, 30, False, False)["total"] == 1000)
check("亲荣和7700", M.calculate_score(3, 40, False, True)["total"] == 7700)
s = M.calculate_score(2, 30, True, True)
check("2翻30符亲自摸3000", s["total"] == 3000 and s["payments"] == [1000, 1000, 1000], s)
s2 = M.calculate_score(2, 30, True, False)
check("2翻30符子自摸2000", s2["total"] == 2000 and s2["payments"] == [1000, 500, 500], s2)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
