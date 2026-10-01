/* Super Grand Slam Online · 网页版麻将引擎
 * 由 backend/app/core/mahjong.py 忠实移植，规则见 docs/rules.md
 * 牌编码 0-33：0-8万 / 9-17筒 / 18-26条 / 27-30东南西北 / 31-33白发中
 */
"use strict";

const MAN = 0, PIN = 9, SOU = 18;
const EAST = 27, SOUTH = 28, WEST = 29, NORTH = 30;
const HAKU = 31, HATSU = 32, CHUN = 33;
const TERMINALS_HONORS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

const TILE_NAMES = ["一万","二万","三万","四万","五万","六万","七万","八万","九万",
  "一筒","二筒","三筒","四筒","五筒","六筒","七筒","八筒","九筒",
  "一条","二条","三条","四条","五条","六条","七条","八条","九条",
  "东","南","西","北","白","发","中"];
const TILE_SHORT = ["1万","2万","3万","4万","5万","6万","7万","8万","9万",
  "1筒","2筒","3筒","4筒","5筒","6筒","7筒","8筒","9筒",
  "1条","2条","3条","4条","5条","6条","7条","8条","9条",
  "东","南","西","北","白","发","中"];

function tileName(t) { return TILE_NAMES[t]; }
function tileShort(t) { return TILE_SHORT[t]; }
function tileRank(t) { return t % 9; }
function isTerminalOrHonor(t) { return TERMINALS_HONORS.includes(t); }

function countsOf(tiles) {
  const c = new Array(34).fill(0);
  for (const t of tiles) c[t]++;
  return c;
}

/* ---------------- 洗牌 / 发牌 ---------------- */
function createWall(seed) {
  const wall = [];
  for (let t = 0; t < 34; t++) for (let k = 0; k < 4; k++) wall.push(t);
  let s = (seed === undefined) ? (Math.random() * 1e9 | 0) : seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = wall.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function deal(wall) {
  const hands = [[], [], [], []];
  let idx = 0;
  for (let r = 0; r < 3; r++)
    for (let p = 0; p < 4; p++) { hands[p].push(...wall.slice(idx, idx + 4)); idx += 4; }
  for (let p = 0; p < 4; p++) hands[p].push(wall[idx++]);
  hands[0].push(wall[idx++]);
  for (const h of hands) h.sort((a, b) => a - b);
  return { hands, rest: wall.slice(idx) };
}

/* ---------------- 胡牌判定 ---------------- */
function decomposeMelds(counts, need) {
  let t = -1;
  for (let i = 0; i < 34; i++) if (counts[i]) { t = i; break; }
  if (t === -1) return need === 0 ? [[]] : [];
  if (need <= 0) return [];
  const out = [];
  if (counts[t] >= 3) {
    counts[t] -= 3;
    for (const rest of decomposeMelds(counts, need - 1)) out.push([[t, t, t], ...rest]);
    counts[t] += 3;
  }
  if (t < 27 && tileRank(t) <= 6 && counts[t + 1] && counts[t + 2]) {
    counts[t]--; counts[t + 1]--; counts[t + 2]--;
    for (const rest of decomposeMelds(counts, need - 1)) out.push([[t, t + 1, t + 2], ...rest]);
    counts[t]++; counts[t + 1]++; counts[t + 2]++;
  }
  return out;
}

function decomposeStandard(counts, openMelds = 0) {
  const need = 4 - openMelds;
  if (need < 0) return [];
  const c = counts.slice(), out = [];
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      for (const melds of decomposeMelds(c, need)) out.push({ pair: p, melds });
      c[p] += 2;
    }
  }
  return out;
}

function isChiitoi(counts) {
  return counts.filter(c => c === 2).length === 7 && counts.every(c => c <= 2);
}

function isKokushi(counts) {
  const kinds = TERMINALS_HONORS.filter(t => counts[t] >= 1).length;
  const pair = TERMINALS_HONORS.some(t => counts[t] >= 2);
  let others = 0;
  for (let t = 0; t < 34; t++) if (!TERMINALS_HONORS.includes(t)) others += counts[t];
  return kinds === 13 && pair && others === 0;
}

function isWinning(counts, openMelds = 0) {
  const c = counts.slice();
  if (openMelds === 0 && (isChiitoi(c) || isKokushi(c))) return true;
  return decomposeStandard(c, openMelds).length > 0;
}

/* ---------------- 向听数 ---------------- */
function shantenStandard(counts, openMelds = 0) {
  const c = counts.slice();
  let best = 8;
  function leaf(melds, taatsu, pair) {
    let m = melds + openMelds, t = taatsu;
    if (m > 4) m = 4;
    if (m + t > 4) t = 4 - m;
    const s = 8 - 2 * m - t - (pair ? 1 : 0);
    if (s < best) best = s;
  }
  function dfs(pos, melds, taatsu, pair) {
    while (pos < 34 && c[pos] === 0) pos++;
    if (pos >= 34) { leaf(melds, taatsu, pair); return; }
    const n = c[pos], r = tileRank(pos);
    if (n >= 3) { c[pos] -= 3; dfs(pos, melds + 1, taatsu, pair); c[pos] += 3; }
    if (pos < 27 && r <= 6 && c[pos + 1] && c[pos + 2]) {
      c[pos]--; c[pos + 1]--; c[pos + 2]--;
      dfs(pos, melds + 1, taatsu, pair);
      c[pos]++; c[pos + 1]++; c[pos + 2]++;
    }
    if (n >= 2) {
      c[pos] -= 2;
      if (pair) dfs(pos, melds, taatsu + 1, pair); else dfs(pos, melds, taatsu, true);
      c[pos] += 2;
    }
    if (pos < 27 && r <= 7 && c[pos + 1]) {
      c[pos]--; c[pos + 1]--; dfs(pos, melds, taatsu + 1, pair); c[pos]++; c[pos + 1]++;
    }
    if (pos < 27 && r <= 6 && c[pos + 2]) {
      c[pos]--; c[pos + 2]--; dfs(pos, melds, taatsu + 1, pair); c[pos]++; c[pos + 2]++;
    }
    c[pos]--; dfs(pos + 1, melds, taatsu, pair); c[pos]++;
  }
  dfs(0, 0, 0, false);
  return best;
}

function shantenChiitoi(counts) {
  const pairs = counts.filter(x => x >= 2).length;
  const singles = counts.filter(x => x === 1).length;
  const need = Math.max(0, 6 - pairs);
  const use = Math.min(singles, need);
  return use + 2 * (need - use);
}

function shantenKokushi(counts) {
  const kinds = TERMINALS_HONORS.filter(t => counts[t] >= 1).length;
  const pair = TERMINALS_HONORS.some(t => counts[t] >= 2) ? 1 : 0;
  return 13 - kinds - pair;
}

function shanten(counts, openMelds = 0) {
  let s = shantenStandard(counts, openMelds);
  if (openMelds === 0) s = Math.min(s, shantenChiitoi(counts), shantenKokushi(counts));
  return s;
}

/* ---------------- 番种 ---------------- */
function doraTile(ind) {
  if (ind < 27) return ((ind / 9) | 0) * 9 + (tileRank(ind) + 1) % 9;
  if (ind < 31) return 27 + (ind - 27 + 1) % 4;
  return 31 + (ind - 31 + 1) % 3;
}

function detectYaku(counts, melds, winTile, ctx, decomp) {
  const yaku = [];
  const menzen = melds.length === 0 || melds.every(m => m.concealed);
  const tiles = [];
  counts.forEach((n, t) => { for (let k = 0; k < n; k++) tiles.push(t); });
  for (const m of melds) tiles.push(...m.tiles);

  if (isKokushi(counts)) return [["国士无双", 13]];
  if (decomp === null) {
    if (isChiitoi(counts)) yaku.push(["七对子", 2]);
  } else {
    const allMelds = decomp.melds.concat(melds.map(m => m.tiles));
    const pair = decomp.pair;
    const isAllChi = decomp.melds.every(m => {
      const s = [...new Set(m)].sort((a, b) => a - b);
      return s.length === 3 && s[0] < 27 && s[2] - s[0] === 2;
    });
    const isAllPon = decomp.melds.every(m => new Set(m).size === 1);
    const yakuhai = t => t === HAKU || t === HATSU || t === CHUN ||
      t === ctx.seatWind || t === ctx.roundWind;

    for (const m of allMelds) {
      if (new Set(m).size === 1) {
        const t = m[0];
        if (t === HAKU) yaku.push(["役牌·白", 1]);
        else if (t === HATSU) yaku.push(["役牌·發", 1]);
        else if (t === CHUN) yaku.push(["役牌·中", 1]);
        else if (t === ctx.seatWind && t === ctx.roundWind) yaku.push(["役牌·连风刻", 2]);
        else if (t === ctx.seatWind) yaku.push(["役牌·自风", 1]);
        else if (t === ctx.roundWind) yaku.push(["役牌·场风", 1]);
      }
    }
    if (tiles.every(t => !isTerminalOrHonor(t))) yaku.push(["断幺九", 1]);
    const suits = new Set(tiles.filter(t => t < 27).map(t => (t / 9) | 0));
    const hasHonor = tiles.some(t => t >= 27);
    if (suits.size === 1 && !hasHonor) yaku.push(["清一色", menzen ? 6 : 5]);
    else if (suits.size === 1 && hasHonor) yaku.push(["混一色", menzen ? 3 : 2]);
    if (isAllPon) {
      yaku.push(["对对和", 2]);
      if (tiles.every(isTerminalOrHonor)) yaku.push(["混老头", 2]);
    }
    const chiSets = {};
    for (const m of decomp.melds) {
      const s = [...new Set(m)].sort((a, b) => a - b);
      if (s.length === 3 && s[0] < 27 && s[2] - s[0] === 2) {
        const suit = (s[0] / 9) | 0;
        (chiSets[suit] = chiSets[suit] || []).push(tileRank(s[0]));
      }
    }
    for (const suit of Object.keys(chiSets)) {
      const st = new Set(chiSets[suit]);
      if (st.has(0) && st.has(3) && st.has(6)) yaku.push(["一气通贯", menzen ? 2 : 1]);
    }
    for (let r = 0; r < 7; r++) {
      if ([0, 1, 2].every(su => (chiSets[su] || []).includes(r))) {
        yaku.push(["三色同顺", menzen ? 2 : 1]); break;
      }
    }
    const ponRanks = {};
    for (const m of allMelds) {
      if (new Set(m).size === 1 && m[0] < 27) {
        const r = tileRank(m[0]);
        (ponRanks[r] = ponRanks[r] || new Set()).add((m[0] / 9) | 0);
      }
    }
    for (const r of Object.keys(ponRanks))
      if (ponRanks[r].size === 3) { yaku.push(["三色同刻", 2]); break; }
    const hasTerminal = m => m.some(isTerminalOrHonor);
    if (allMelds.every(hasTerminal) && isTerminalOrHonor(pair)) {
      yaku.push(hasHonor ? ["混全带幺九", menzen ? 2 : 1] : ["纯全带幺九", menzen ? 3 : 2]);
    }
    const concealedPon = decomp.melds.filter(m => new Set(m).size === 1).length +
      melds.filter(m => m.kind === "closed_kan").length;
    if (concealedPon >= 3) yaku.push(["三暗刻", 2]);
    if (melds.filter(m => m.kind.includes("kan")).length >= 3) yaku.push(["三杠子", 2]);
    const sangenPon = [HAKU, HATSU, CHUN].filter(t =>
      allMelds.some(m => new Set(m).size === 1 && m[0] === t)).length;
    if (sangenPon === 2 && [HAKU, HATSU, CHUN].includes(pair)) yaku.push(["小三元", 2]);
    if (sangenPon === 3) return [["大三元", 13]];
    if (menzen && isAllChi && !yakuhai(pair)) {
      const winMeld = decomp.melds.find(m => m.includes(winTile));
      let pinfu = false;
      if (winMeld) {
        const s = [...winMeld].sort((a, b) => a - b), a = s[0], r = tileRank(a);
        if (s[1] === winTile) pinfu = false;
        else if (winTile === a) pinfu = r >= 1;
        else pinfu = r <= 5;
      }
      if (pinfu) yaku.push(["平和", 1]);
      const seqs = decomp.melds.map(m => [...m].sort((a, b) => a - b).join(",")).sort();
      if (seqs[0] === seqs[1] && seqs[2] === seqs[3]) yaku.push(["二盃口", 3]);
      else if (seqs[0] === seqs[1] || seqs[1] === seqs[2] || seqs[2] === seqs[3]) yaku.push(["一盃口", 1]);
    }
  }

  if (ctx.tsumo && menzen) yaku.push(["门前清自摸和", 1]);
  if (ctx.doubleRiichi) yaku.push(["双立直", 2]);
  else if (ctx.riichi) yaku.push(["立直", 1]);
  if (ctx.ippatsu) yaku.push(["一发", 1]);
  if (ctx.rinshan) yaku.push(["岭上开花", 1]);
  if (ctx.chankan) yaku.push(["抢杠", 1]);
  if (ctx.haitei) yaku.push(["海底摸月", 1]);
  if (ctx.houtei) yaku.push(["河底捞鱼", 1]);
  let dora = 0;
  for (const ind of ctx.doraIndicators || []) dora += tiles.filter(t => t === doraTile(ind)).length;
  for (const ind of ctx.uraIndicators || []) dora += tiles.filter(t => t === doraTile(ind)).length;
  if (dora) yaku.push(["宝牌", dora]);
  return yaku;
}

/* ---------------- 符 / 点数 ---------------- */
function waitFu(decomp, winTile) {
  if (decomp.pair === winTile) return 2;
  for (const m of decomp.melds) {
    if (!m.includes(winTile)) continue;
    const s = [...m].sort((a, b) => a - b);
    if (new Set(s).size === 1) return 2;
    const a = s[0], r = tileRank(a);
    if (s[1] === winTile) return 2;
    if (winTile === a) return r >= 1 ? 0 : 2;
    return r <= 5 ? 0 : 2;
  }
  return 0;
}

function calculateFu(counts, melds, winTile, ctx, decomp, yakuNames) {
  if (isChiitoi(counts)) return 25;
  const menzen = melds.length === 0 || melds.every(m => m.concealed);
  let fu = 20;
  if (!ctx.tsumo && menzen) fu += 10;
  if (ctx.tsumo && !yakuNames.includes("平和")) fu += 2;
  if (decomp) {
    const p = decomp.pair;
    if (p === HAKU || p === HATSU || p === CHUN) fu += 2;
    if (p === ctx.seatWind) fu += 2;
    if (p === ctx.roundWind) fu += 2;
    for (const m of decomp.melds) {
      if (new Set(m).size === 1) fu += isTerminalOrHonor(m[0]) ? 16 : 4;
    }
    for (const m of melds) {
      const term = isTerminalOrHonor(m.tiles[0]);
      if (m.kind === "pon") fu += term ? 8 : 2;
      else if (m.kind === "open_kan") fu += term ? 32 : 8;
      else if (m.kind === "closed_kan") fu += term ? 64 : 16;
    }
    fu += waitFu(decomp, winTile);
  }
  return Math.ceil(fu / 10) * 10;
}

function roundUp100(n) { return Math.ceil(n / 100) * 100; }

function calculateScore(han, fu, tsumo, dealer) {
  let base;
  if (han >= 13) base = 8000;
  else if (han >= 11) base = 6000;
  else if (han >= 8) base = 4000;
  else if (han >= 6) base = 3000;
  else if (han >= 5 || (han === 4 && fu >= 40) || (han === 3 && fu >= 70)) base = 2000;
  else base = fu * Math.pow(2, han + 2);
  if (tsumo) {
    if (dealer) {
      const pay = roundUp100(base * 2);
      return { total: pay * 3, payments: [pay, pay, pay], base };
    }
    const pd = roundUp100(base * 2), po = roundUp100(base);
    return { total: pd + po * 2, payments: [pd, po, po], base };
  }
  const total = roundUp100(base * (dealer ? 6 : 4));
  return { total, payments: [total], base };
}

function checkAgari(counts, melds, winTile, ctx, dealer) {
  const c = counts.slice();
  c[winTile]++;
  const openN = melds.filter(m => !m.concealed).length;
  const candidates = [];
  if (openN === 0 && isChiitoi(c)) candidates.push(null);
  if (openN === 0 && isKokushi(c)) candidates.push(null);
  candidates.push(...decomposeStandard(c, melds.length));
  let best = null;
  for (const decomp of candidates) {
    const yaku = detectYaku(c, melds, winTile, ctx, decomp);
    const han = yaku.reduce((s, y) => s + y[1], 0);
    if (han <= 0) continue;
    const names = yaku.map(y => y[0]);
    const fu = calculateFu(c, melds, winTile, ctx, decomp, names);
    const score = calculateScore(han, fu, ctx.tsumo, dealer);
    if (!best || han > best.han || (han === best.han && score.total > best.score.total))
      best = { yaku, han, fu, score, decomp };
  }
  return best;
}

function ukeireCount(counts, openMelds = 0, visible = null) {
  const cur = shanten(counts, openMelds);
  if (cur < 0) return 0;
  const unavail = new Array(34).fill(0);
  if (visible) for (const t of visible) unavail[t]++;
  const c = counts.slice();
  let total = 0;
  for (let t = 0; t < 34; t++) {
    if (counts[t] + unavail[t] >= 4) continue;
    c[t]++;
    if (shanten(c, openMelds) < cur) total += 4 - counts[t] - unavail[t];
    c[t]--;
  }
  return total;
}

/* 听牌时的荣和牌列表（含振听判断用） */
function winningTiles(counts, melds, ctx) {
  const out = [];
  for (let t = 0; t < 34; t++) {
    if (counts[t] >= 4) continue;
    const r = checkAgari(counts, melds, t, { ...ctx, tsumo: false }, false);
    if (r) out.push(t);
  }
  return out;
}

if (typeof module !== "undefined") {
  module.exports = {
    EAST, SOUTH, WEST, NORTH, HAKU, HATSU, CHUN,
    tileName, tileShort, tileRank, isTerminalOrHonor, countsOf,
    createWall, deal, isWinning, isChiitoi, isKokushi, shanten,
    detectYaku, calculateFu, calculateScore, checkAgari, ukeireCount,
    winningTiles, doraTile, decomposeStandard,
  };
} else if (typeof window !== "undefined") {
  window.Mahjong = {
    EAST, SOUTH, WEST, NORTH, HAKU, HATSU, CHUN,
    tileName, tileShort, tileRank, isTerminalOrHonor, countsOf,
    createWall, deal, isWinning, isChiitoi, isKokushi, shanten,
    detectYaku, calculateFu, calculateScore, checkAgari, ukeireCount,
    winningTiles, doraTile, decomposeStandard,
  };
}
