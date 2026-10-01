(() => {
/* Super Grand Slam Online · 网页版对局流程
 * 半庄 8 局（東1-南4）+ 连庄，无需后端，浏览器/Node 共用。
 * UI 驱动接口 ui = { chooseDiscard, chooseCall, onEvent }
 */
"use strict";
const M = (typeof module !== "undefined") ? require("./mahjong.js") : window.Mahjong;
const AI = (typeof module !== "undefined") ? require("./ai.js") : window.MahjongAI;

const NAMES = ["你", "AI·松", "AI·竹", "AI·梅"];
const ROUND_NAMES = ["東一局", "東二局", "東三局", "東四局", "南一局", "南二局", "南三局", "南四局"];
const SEAT_MARKS = ["東", "南", "西", "北"];

function roundUp100(n) { return Math.ceil(n / 100) * 100; }

class Match {
  constructor({ aiLevels = [0, 2, 2, 2], humanSeat = 0, seed } = {}) {
    this.aiLevels = aiLevels;
    this.humanSeat = humanSeat;
    this.seed = seed;
    this.scores = [25000, 25000, 25000, 25000];
    this.round = 0;
    this.dealer = 0;
    this.honba = 0;
    this.sticks = 0;
    this.extra = 0;
    this.over = false;
    this.rng = seed === undefined ? Math.random : (() => {
      let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    })();
  }

  isHuman(seat) { return seat === this.humanSeat; }
  seatWind(seat) { return 27 + ((seat - this.dealer + 4) % 4); }
  roundWind() { return this.round < 4 ? 27 : 28; }

  newPlayer(seat) {
    return {
      seat, name: this.isHuman(seat) ? "你" : `${NAMES[seat]} Lv${this.aiLevels[seat]}`,
      hand: [], melds: [], discards: [],
      riichi: false, doubleRiichi: false, ippatsu: false,
    };
  }

  setupRound() {
    const wall = M.createWall((this.rng() * 1e9) | 0);
    const { hands, rest } = M.deal(wall);
    this.players = [0, 1, 2, 3].map(s => this.newPlayer(s));
    // deal() 总是把 14 张（庄家牌）放在 hands[0]，把它交到真正的庄家手里
    this.players.forEach((p, i) => { p.hand = hands[(i - this.dealer + 4) % 4]; });
    this.deadWall = rest.slice(-14);
    this.wall = rest.slice(0, -14);
    this.rinshanIdx = 0;
    this.doraIndicators = [this.deadWall[4]];
    this.kanCount = 0;
    this.turnCount = 0;
    this.anyCall = false;
  }

  rinshanDraw() {
    const t = this.deadWall[this.rinshanIdx++];
    this.kanCount++;
    this.doraIndicators.push(this.deadWall[4 + this.kanCount * 2]);
    return t;
  }

  winCtx(seat, o = {}) {
    const p = this.players[seat];
    return {
      tsumo: false, riichi: p.riichi, doubleRiichi: p.doubleRiichi, ippatsu: p.ippatsu,
      rinshan: false, chankan: false, haitei: false, houtei: false,
      doraIndicators: this.doraIndicators.slice(),
      uraIndicators: p.riichi ? this.doraIndicators.map(d => this.deadWall[this.deadWall.indexOf(d) + 1]) : [],
      seatWind: this.seatWind(seat), roundWind: this.roundWind(),
      ...o,
    };
  }

  clearIppatsu() { this.players.forEach(p => p.ippatsu = false); }

  /* 荣和判定（含振听） */
  ronOption(seat, tile, fromSeat, chankan = false) {
    const p = this.players[seat];
    const counts = M.countsOf(p.hand);
    const ctx = this.winCtx(seat, { chankan, houtei: this.wall.length === 0 && !chankan });
    const res = M.checkAgari(counts, p.melds, tile, ctx, seat === this.dealer);
    if (!res) return null;
    if (!chankan) {
      const waits = M.winningTiles(counts, p.melds, this.winCtx(seat));
      if (waits.some(t => p.discards.includes(t))) return null; // 振听
    }
    return res;
  }

  discardOptions(seat, drawn) {
    const p = this.players[seat];
    const full = M.countsOf(p.hand);          // 含摸牌的完整手牌
    const counts = full.slice();
    let tsumo = null;
    if (drawn >= 0) {
      counts[drawn]--;
      const ctx = this.winCtx(seat, { tsumo: true, haitei: this.wall.length === 0 });
      tsumo = M.checkAgari(counts, p.melds, drawn, ctx, seat === this.dealer);
    }
    // 杠：用完整手牌判定（不会漏掉"刚摸到第 4 张"的暗杠）；全场最多 4 个杠
    const kans = [];
    if (this.kanCount < 4) {
      for (let t = 0; t < 34; t++) if (full[t] === 4) kans.push({ kind: "closed", tile: t });
      for (const m of p.melds)
        if (m.kind === "pon" && p.hand.includes(m.tiles[0])) kans.push({ kind: "added", tile: m.tiles[0] });
    }
    // 立直：门前、未立直、有 1000 点、余 4 张以上，且存在一张切出后听牌的牌
    const menzen = p.melds.every(m => m.concealed);
    const openN = p.melds.filter(m => !m.concealed).length;
    let canRiichi = false;
    if (!p.riichi && menzen && p.hand.length % 3 === 2 &&
        this.scores[seat] >= 1000 && this.wall.length >= 4) {
      // 从完整手牌逐张试切：存在切出后听牌的牌即可立直
      for (const t of [...new Set(p.hand)]) {
        full[t]--;
        if (M.shanten(full, openN) === 0) canRiichi = true;
        full[t]++;
        if (canRiichi) break;
      }
    }
    return { drawn, tsumo, kans, canRiichi, locked: p.riichi };
  }

  removeFromHand(seat, tile, n = 1) {
    const h = this.players[seat].hand;
    for (let k = 0; k < n; k++) h.splice(h.indexOf(tile), 1);
  }

  async play(ui) {
    this.ui = ui;
    while (!this.over) {
      await this.playRound(ui);
      if (this.scores.some(s => s < 0)) { this.over = true; this.endReason = "破产终局"; }
      else if (this.round > 7) this.over = true;
    }
    if (this.sticks > 0) { // 供托归一位
      const top = this.scores.indexOf(Math.max(...this.scores));
      this.scores[top] += this.sticks * 1000; this.sticks = 0;
    }
    const ranking = [0, 1, 2, 3].sort((a, b) => this.scores[b] - this.scores[a]);
    await ui.onEvent({ t: "match_end", scores: this.scores.slice(), ranking, reason: this.endReason || "半庄结束" });
  }

  async playRound(ui) {
    this.setupRound();
    await ui.onEvent({ t: "round_start", round: ROUND_NAMES[this.round], honba: this.honba, sticks: this.sticks, dealer: this.dealer, dora: this.doraIndicators.slice() });
    await this.turnLoop(this.dealer, ui, true);
  }

  async declareRiichi(seat, ui) {
    const p = this.players[seat];
    p.riichi = true;
    p.ippatsu = true;
    p.doubleRiichi = this.turnCount <= 4 && !this.anyCall;
    this.scores[seat] -= 1000;
    this.sticks++;
    await ui.onEvent({ t: "riichi", seat });
  }

  async applySelfKan(seat, act, ui) {
    const p = this.players[seat];
    if (act.kind === "closed") {
      this.removeFromHand(seat, act.tile, 4);
      p.melds.push({ kind: "closed_kan", tiles: [act.tile, act.tile, act.tile, act.tile], concealed: true });
    } else {
      const m = p.melds.find(m => m.kind === "pon" && m.tiles[0] === act.tile);
      m.kind = "added_kan"; m.tiles.push(act.tile); m.concealed = false;
      this.removeFromHand(seat, act.tile, 1);
      // 抢杠
      const order = [1, 2, 3].map(i => (seat + i) % 4);
      for (const s of order) {
        const res = this.ronOption(s, act.tile, seat, true);
        if (res && await this.askRon(s, act.tile, seat, res, ui)) {
          await this.applyWin(s, seat, act.tile, res, ui);
          return "chankan_win";
        }
      }
    }
    await ui.onEvent({ t: "kan", seat, kind: act.kind, tile: act.tile, dora: this.doraIndicators.slice() });
    return "ok";
  }

  async askRon(seat, tile, fromSeat, res, ui) {
    if (this.isHuman(seat)) {
      const act = await ui.chooseCall(seat, tile, fromSeat, [{ type: "ron", label: `荣和 ${res.han}翻${res.fu}符`, result: res }]);
      return act && act.type === "ron";
    }
    const lv = this.aiLevels[seat];
    return lv <= 1 ? Math.random() < 0.5 : true;
  }

  callOptions(seat, tile, fromSeat) {
    const p = this.players[seat];
    const counts = M.countsOf(p.hand);
    const opts = [];
    const ron = this.ronOption(seat, tile, fromSeat);
    if (ron) opts.push({ type: "ron", label: `荣和 ${ron.han}翻${ron.fu}符`, result: ron });
    if (counts[tile] >= 2) opts.push({ type: "pon", label: `碰 ${M.tileShort(tile)}` });
    if (counts[tile] >= 3 && this.wall.length > 0 && this.kanCount < 4) opts.push({ type: "kan", label: `杠 ${M.tileShort(tile)}` });
    if (seat === (fromSeat + 1) % 4 && tile < 27) {
      const r = M.tileRank(tile), suit = (tile / 9) | 0;
      const has = (a, b) => (a / 9 | 0) === suit && (b / 9 | 0) === suit && counts[a] && counts[b];
      if (r >= 2 && has(tile - 2, tile - 1)) opts.push({ type: "chi", tiles: [tile - 2, tile - 1], label: `吃 ${M.tileShort(tile - 2)}${M.tileShort(tile - 1)}` });
      if (r >= 1 && r <= 7 && has(tile - 1, tile + 1)) opts.push({ type: "chi", tiles: [tile - 1, tile + 1], label: `吃 ${M.tileShort(tile - 1)}${M.tileShort(tile + 1)}` });
      if (r <= 6 && has(tile + 1, tile + 2)) opts.push({ type: "chi", tiles: [tile + 1, tile + 2], label: `吃 ${M.tileShort(tile + 1)}${M.tileShort(tile + 2)}` });
    }
    return opts;
  }

  async checkCalls(fromSeat, tile, ui) {
    const order = [1, 2, 3].map(i => (fromSeat + i) % 4);
    const fromP = this.players[fromSeat];
    // 被副露的牌从牌河拿走（永远是牌河最后一张）
    const takeCalledTile = () => { fromP.discards.pop(); };
    // 荣和优先（按摸牌顺序）
    for (const s of order) {
      const res = this.ronOption(s, tile, fromSeat);
      if (res && await this.askRon(s, tile, fromSeat, res, ui)) {
        await this.applyWin(s, fromSeat, tile, res, ui);
        return "win";
      }
    }
    // 立直后的打牌不能被吃/碰/杠（只能荣和）
    if (!fromP.riichi) {
    // 碰 / 杠
    for (const s of order) {
      const p = this.players[s];
      const counts = M.countsOf(p.hand);
      if (counts[tile] >= 2 && !p.riichi) {
        let want = null;
        if (this.isHuman(s)) {
          const opts = this.callOptions(s, tile, fromSeat).filter(o => o.type === "pon" || o.type === "kan");
          if (opts.length) { const a = await ui.chooseCall(s, tile, fromSeat, opts); if (a) want = a.type; }
        } else {
          const lv = this.aiLevels[s];
          if (counts[tile] >= 3 && this.wall.length > 0 && this.kanCount < 4 && lv >= 2 && Math.random() < 0.6) want = "kan";
          else if (AI.decidePon(p.hand, tile, lv, this.seatWind(s), this.roundWind())) want = "pon";
        }
        if (want === "kan") {
          takeCalledTile();
          this.clearIppatsu(); this.anyCall = true;
          this.removeFromHand(s, tile, 3);
          p.melds.push({ kind: "open_kan", tiles: [tile, tile, tile, tile], from: fromSeat, concealed: false });
          await ui.onEvent({ t: "kan", seat: s, kind: "open", tile, from: fromSeat, dora: this.doraIndicators.slice() });
          const rd = this.rinshanDraw();
          p.hand.push(rd);
          await ui.onEvent({ t: "rinshan", seat: s, tile: this.isHuman(s) ? rd : -1, dora: this.doraIndicators.slice() });
          // 杠后直接进入摸牌后决策：把补牌当作 drawn 处理（内部驱动本局剩余流程）
          await this.afterKanDiscard(s, rd, ui);
          return "done";
        }
        if (want === "pon") {
          takeCalledTile();
          this.removeFromHand(s, tile, 2);
          p.melds.push({ kind: "pon", tiles: [tile, tile, tile], from: fromSeat, concealed: false });
          await ui.onEvent({ t: "pon", seat: s, tile, from: fromSeat });
          return s;
        }
      }
    }
    // 吃（仅下家）
    const shimo = (fromSeat + 1) % 4;
    const p = this.players[shimo];
    if (!p.riichi) {
      const lv = this.isHuman(shimo) ? 99 : this.aiLevels[shimo];
      let chiTiles = null;
      if (this.isHuman(shimo)) {
        const opts = this.callOptions(shimo, tile, fromSeat).filter(o => o.type === "chi");
        if (opts.length) {
          const a = await ui.chooseCall(shimo, tile, fromSeat, opts);
          if (a && a.type === "chi") chiTiles = a.tiles;
        }
      } else {
        chiTiles = AI.decideChi(p.hand, tile, lv);
      }
      if (chiTiles) {
        takeCalledTile();
        this.removeFromHand(shimo, chiTiles[0]); this.removeFromHand(shimo, chiTiles[1]);
        p.melds.push({ kind: "chi", tiles: [chiTiles[0], chiTiles[1], tile].sort((a, b) => a - b), from: fromSeat, concealed: false });
        await ui.onEvent({ t: "chi", seat: shimo, tiles: chiTiles, tile, from: fromSeat });
        return shimo;
      }
    }
    } // end if (!fromP.riichi)
    return null;
  }

  /* 明杠补牌后的出牌决策（复用摸牌后流程） */
  async afterKanDiscard(seat, drawn, ui) {
    const p = this.players[seat];
    for (;;) {
      const opts = this.discardOptions(seat, drawn);
      opts.rinshan = true;
      const act = this.isHuman(seat)
        ? await ui.chooseDiscard(seat, p.hand.slice().sort((a, b) => a - b), opts)
        : this.aiDiscardAction(seat, p.hand, opts);
      if (act.type === "tsumo") {
        const counts = M.countsOf(p.hand); counts[drawn]--;
        const ctx = this.winCtx(seat, { tsumo: true, rinshan: true });
        const res = M.checkAgari(counts, p.melds, drawn, ctx, seat === this.dealer);
        await this.applyWin(seat, null, drawn, res, ui); return;
      }
      if (act.type === "kan") {
        const kres = await this.applySelfKan(seat, act, ui);
        if (kres === "chankan_win") return;
        this.clearIppatsu(); this.anyCall = true;
        drawn = this.rinshanDraw(); p.hand.push(drawn);
        await ui.onEvent({ t: "rinshan", seat, tile: this.isHuman(seat) ? drawn : -1, dora: this.doraIndicators.slice() });
        continue;
      }
      if (act.type === "riichi") await this.declareRiichi(seat, ui);
      this.removeFromHand(seat, act.tile);
      p.discards.push(act.tile); p.hand.sort((a, b) => a - b);
      await ui.onEvent({ t: "discard", seat, tile: act.tile, riichi: act.type === "riichi" });
      const callRes = await this.checkCalls(seat, act.tile, ui);
      if (callRes === "win" || callRes === "done") return;
      if (callRes !== null) { await this.afterCallDiscard(callRes, ui); return; }
      await this.turnLoop((seat + 1) % 4, ui); return;
    }
  }

  async afterCallDiscard(seat, ui) {
    const p = this.players[seat];
    const act = this.isHuman(seat)
      ? await ui.chooseDiscard(seat, p.hand.slice().sort((a, b) => a - b), { drawn: -1, tsumo: null, kans: [], canRiichi: false, locked: false })
      : this.aiDiscardAction(seat, p.hand, {});
    this.removeFromHand(seat, act.tile);
    p.discards.push(act.tile); p.hand.sort((a, b) => a - b);
    await ui.onEvent({ t: "discard", seat, tile: act.tile });
    const callRes = await this.checkCalls(seat, act.tile, ui);
    if (callRes === "win" || callRes === "done") return;
    if (callRes !== null) { await this.afterCallDiscard(callRes, ui); return; }
    await this.turnLoop((seat + 1) % 4, ui);
  }

  /* 主循环（供副露后跳转）；skipDraw=true 时首巡不摸牌（庄家起手 14 张直接切） */
  async turnLoop(turn, ui, skipDraw = false) {
    let result = null;
    let first = skipDraw;
    while (!result) {
      if (this.wall.length === 0) { await this.exhaustive(ui); break; }
      const p = this.players[turn];
      this.turnCount++;
      let drawn = -1, rinshan = false;
      if (first) {
        first = false;
        await ui.onEvent({ t: "draw", seat: turn, tile: -1, firstTurn: true });
      } else {
        const tile = this.wall.shift();
        p.hand.push(tile);
        drawn = tile;
        await ui.onEvent({ t: "draw", seat: turn, tile: this.isHuman(turn) ? tile : -1 });
      }
      for (;;) {
        const opts = this.discardOptions(turn, drawn);
        const act = this.isHuman(turn)
          ? await ui.chooseDiscard(turn, p.hand.slice().sort((a, b) => a - b), opts)
          : this.aiDiscardAction(turn, p.hand, opts);
        if (act.type === "tsumo") {
          const counts = M.countsOf(p.hand); counts[drawn]--;
          const res = M.checkAgari(counts, p.melds, drawn, this.winCtx(turn, { tsumo: true, rinshan, haitei: this.wall.length === 0 }), turn === this.dealer);
          await this.applyWin(turn, null, drawn, res, ui); result = { win: true }; break;
        }
        if (act.type === "kan") {
          const kres = await this.applySelfKan(turn, act, ui);
          if (kres === "chankan_win") { result = { win: true }; break; }
          this.clearIppatsu(); this.anyCall = true;
          drawn = this.rinshanDraw(); p.hand.push(drawn); rinshan = true;
          await ui.onEvent({ t: "rinshan", seat: turn, tile: this.isHuman(turn) ? drawn : -1, dora: this.doraIndicators.slice() });
          continue;
        }
        if (act.type === "riichi") await this.declareRiichi(turn, ui);
        this.removeFromHand(turn, act.tile);
        p.discards.push(act.tile); p.hand.sort((a, b) => a - b);
        await ui.onEvent({ t: "discard", seat: turn, tile: act.tile, riichi: act.type === "riichi" });
        break;
      }
      if (result) break;
      const callRes = await this.checkCalls(turn, p.discards[p.discards.length - 1], ui);
      if (callRes === "win" || callRes === "done") break;
      if (callRes !== null) { await this.afterCallDiscard(callRes, ui); break; }
      turn = (turn + 1) % 4;
    }
  }

  aiDiscardAction(seat, hand, opts) {
    const lv = this.aiLevels[seat];
    const p = this.players[seat];
    if (opts.tsumo) return { type: "tsumo" };
    if (opts.kans && opts.kans.length && (lv >= 2 ? Math.random() < 0.5 : Math.random() < 0.2))
      return { type: "kan", kind: opts.kans[0].kind, tile: opts.kans[0].tile };
    const openN = p.melds.filter(m => !m.concealed).length;
    if (opts.canRiichi && AI.decideRiichi(hand, openN, this.scores[seat], lv)) {
      const counts = M.countsOf(hand);
      let bestT = hand[0], bestS = 99;
      for (const t of [...new Set(hand)]) {
        counts[t]--;
        const s = M.shanten(counts, openN);
        counts[t]++;
        if (s === 0) { const u = M.ukeireCount(counts, openN); if (u < bestS || bestS === 99) { bestS = u; bestT = t; } }
      }
      return { type: "riichi", tile: bestT };
    }
    const visible = [];
    this.players.forEach(q => { visible.push(...q.discards); q.melds.forEach(m => visible.push(...m.tiles)); });
    const t = AI.chooseDiscard(hand, openN, lv, visible, seat, this.players.map(q => q.discards));
    return { type: "discard", tile: t };
  }

  async applyWin(winner, fromSeat, tile, res, ui) {
    const tsumo = fromSeat === null || fromSeat === undefined;
    const dealer = this.dealer;
    const base = res.score.base;
    const pay = amt => { this.scores[winner] += amt; };
    if (tsumo) {
      if (winner === dealer) {
        const each = roundUp100(base * 2);
        [0, 1, 2, 3].filter(s => s !== winner).forEach(s => { this.scores[s] -= each; pay(each); });
      } else {
        const pd = roundUp100(base * 2), po = roundUp100(base);
        [0, 1, 2, 3].filter(s => s !== winner).forEach(s => {
          const a = s === dealer ? pd : po; this.scores[s] -= a; pay(a);
        });
      }
      if (this.honba) [0, 1, 2, 3].filter(s => s !== winner).forEach(s => { this.scores[s] -= 100 * this.honba; pay(100 * this.honba); });
    } else {
      const pts = roundUp100(base * (winner === dealer ? 6 : 4)) + 300 * this.honba;
      this.scores[fromSeat] -= pts; pay(pts);
    }
    if (this.sticks) { pay(this.sticks * 1000); this.sticks = 0; }
    const renchan = winner === dealer;
    await ui.onEvent({
      t: "win", winner, fromSeat: tsumo ? null : fromSeat, tile,
      yaku: res.yaku, han: res.han, fu: res.fu, points: res.score.total,
      scores: this.scores.slice(), renchan,
      hand: this.players[winner].hand.slice(), melds: this.players[winner].melds,
    });
    if (renchan) {
      this.honba++;
      if (this.round >= 7) { this.extra++; if (this.extra > 2) this.round++; }
    }
    else { this.honba = 0; this.dealer = (this.dealer + 1) % 4; this.round++; }
    return { win: true };
  }

  async exhaustive(ui) {
    const tenpai = this.players.map(p => {
      const counts = M.countsOf(p.hand);
      return M.shanten(counts, p.melds.filter(m => !m.concealed).length) === 0;
    });
    const n = tenpai.filter(Boolean).length;
    if (n > 0 && n < 4) {
      const gain = [0, 3000, 1500, 1000][n], loss = [0, 1000, 1500, 3000][n];
      this.players.forEach((p, s) => { this.scores[s] += tenpai[s] ? gain : -loss; });
    }
    const renchan = tenpai[this.dealer];
    await ui.onEvent({ t: "exhaustive", tenpai, scores: this.scores.slice(), renchan, hands: this.players.map(p => p.hand.slice()) });
    if (renchan) {
      this.honba++;
      if (this.round >= 7) { this.extra++; if (this.extra > 2) this.round++; }
    }
    else { this.honba = 0; this.dealer = (this.dealer + 1) % 4; this.round++; }
    return { exhaustive: true };
  }
}

if (typeof module !== "undefined") module.exports = { Match, ROUND_NAMES, SEAT_MARKS, NAMES };
else window.MahjongMatch = { Match, ROUND_NAMES, SEAT_MARKS, NAMES };

})();
