/* Super Grand Slam Online · 网页版 AI（由 backend/app/core/ai.py 移植） */
"use strict";
const M = (typeof module !== "undefined")
  ? require("./mahjong.js")
  : window.Mahjong;

function chooseDiscard(hand, openMelds, level, visible, seat, discardsAll) {
  const counts = M.countsOf(hand);
  const uniq = [...new Set(hand)];
  if (level <= 1) return hand[(Math.random() * hand.length) | 0];

  if (level === 2) {
    const nonPair = uniq.filter(t => counts[t] === 1);
    const pool = nonPair.length ? nonPair : uniq;
    const terms = pool.filter(t => M.isTerminalOrHonor(t));
    return (terms.length ? terms : pool)[(Math.random() * (terms.length ? terms.length : pool.length)) | 0];
  }

  // LV3+: 最小向听 → 最大进张
  let best = null, bestKey = null;
  for (const t of uniq) {
    counts[t]--;
    const s = M.shanten(counts, openMelds);
    const u = M.ukeireCount(counts, openMelds, visible);
    counts[t]++;
    const key = [-s, u, Math.random()];
    if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      bestKey = key; best = t;
    }
  }
  if (level >= 4 && discardsAll) {
    // 简化危险度：现物=0，否则按别人是否切过/筋粗估
    let safest = best, safestDanger = Infinity;
    for (const t of uniq) {
      let danger = 0;
      for (let p = 0; p < 4; p++) {
        if (p === seat) continue;
        const ds = discardsAll[p] || [];
        if (ds.includes(t)) { danger = -1; break; }
      }
      if (danger === -1) danger = 0;
      else {
        danger = 1;
        for (let p = 0; p < 4; p++) {
          if (p === seat) continue;
          const ds = discardsAll[p] || [];
          if (ds.includes((t + 3) % 34) || ds.includes((t - 3 + 34) % 34)) danger -= 0.5;
        }
        danger = Math.max(0.2, danger);
      }
      counts[t]--;
      const s = M.shanten(counts, openMelds);
      counts[t]++;
      const score = s * 10 + danger;
      if (score < safestDanger + s * 0 - 0) { /* keep shanten priority */ }
      if (s < M.shanten(M.countsOf(hand.filter(x => x !== best)), openMelds)) { safest = best; break; }
      if (danger < safestDanger - 1.5 && s <= -bestKey[0]) { safestDanger = danger; safest = t; }
    }
    return safest;
  }
  return best;
}

function decidePon(hand, tile, level, seatWind, roundWind) {
  const counts = M.countsOf(hand);
  if (counts[tile] < 2) return false;
  if (level <= 1) return Math.random() < 0.5;
  if (tile === M.HAKU || tile === M.HATSU || tile === M.CHUN) return true;
  if (tile === seatWind || tile === roundWind) return true;
  if (level >= 3) {
    const before = M.shanten(counts, 0);
    counts[tile] -= 2;
    const after = M.shanten(counts, 1);
    counts[tile] += 2;
    return after <= before;
  }
  return true;
}

function decideChi(hand, tile, level) {
  const r = M.tileRank(tile);
  const suit = (tile / 9) | 0;
  const counts = M.countsOf(hand);
  const opts = [];
  const seq = (a, b) => (a / 9 | 0) === suit && (b / 9 | 0) === suit && counts[a] && counts[b];
  if (r >= 2 && seq(tile - 2, tile - 1)) opts.push([tile - 2, tile - 1]);
  if (r >= 1 && r <= 7 && seq(tile - 1, tile + 1)) opts.push([tile - 1, tile + 1]);
  if (r <= 6 && seq(tile + 1, tile + 2)) opts.push([tile + 1, tile + 2]);
  if (!opts.length) return null;
  if (level <= 1) return Math.random() < 0.5 ? opts[0] : null;
  if (level === 2) {
    const terminals = opts.filter(o => o.concat(tile).some(M.isTerminalOrHonor));
    return terminals.length ? terminals[0] : opts[0];
  }
  let bestOpt = opts[0], bestU = -1;
  for (const o of opts) {
    const c2 = counts.slice();
    c2[o[0]]--; c2[o[1]]--;
    const u = M.ukeireCount(c2, 1);
    if (u > bestU) { bestU = u; bestOpt = o; }
  }
  return bestOpt;
}

function decideClosedKan(hand, level) {
  const counts = M.countsOf(hand);
  const cands = [];
  for (let t = 0; t < 34; t++) if (counts[t] === 4) cands.push(t);
  if (!cands.length) return null;
  if (level <= 1) return Math.random() < 0.5 ? cands[0] : null;
  return cands[0];
}

function decideRiichi(hand, openMelds, score, level) {
  if (openMelds > 0 || score < 1000) return false;
  const counts = M.countsOf(hand);
  if (M.shanten(counts, 0) !== 0) return false;
  if (level <= 1) return Math.random() < 0.3;
  if (level === 2) return Math.random() < 0.7;
  return true;
}

const AI = { chooseDiscard, decidePon, decideChi, decideClosedKan, decideRiichi };
if (typeof module !== "undefined") module.exports = AI;
else window.MahjongAI = AI;
