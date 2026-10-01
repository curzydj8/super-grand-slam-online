/* 超级大满贯 Online · 浏览器 UI 驱动 */
"use strict";

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 简易音效 */
let audioCtx = null, muted = false;
function beep(freq, dur = 0.08, type = "square", vol = 0.04) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* 无音频环境 */ }
}

class BrowserUI {
  constructor(match) {
    this.match = match;
    this.M = window.Mahjong;
    this.G = window.MahjongMatch;
    this.riichiTileIdx = [-1, -1, -1, -1];
    this.riichiPending = -1;
    this.myDrawn = -1;
    this.turnSeat = -1;
    this.resolve = null;
    this.riichiArmed = false;
  }

  /* ---------- 牌面 ---------- */
  tileEl(t, cls = "") {
    const d = document.createElement("div");
    d.className = "tile " + cls;
    d.dataset.tile = t;
    let name = this.M.tileShort(t);
    d.textContent = name;
    if (t === 31) d.classList.add("honor-haku");
    if (t === 32) d.classList.add("honor-hatsu");
    if (t === 33) d.classList.add("honor-chun");
    return d;
  }
  backEl(cls = "") {
    const d = document.createElement("div");
    d.className = "tile back " + cls;
    d.textContent = "·";
    return d;
  }

  seatWindMark(seat) {
    return this.G.SEAT_MARKS[(seat - this.match.dealer + 4) % 4];
  }

  /* ---------- 渲染 ---------- */
  renderTop() {
    $("tb-round").textContent = this.G.ROUND_NAMES[this.match.round] || "终局";
    $("tb-honba").textContent = this.match.honba;
    $("tb-sticks").textContent = this.match.sticks;
    $("tb-wall").textContent = this.match.wall.length;
    $("center-wind").textContent = (this.G.ROUND_NAMES[this.match.round] || "終")[0];
    const dd = $("tb-dora"); dd.innerHTML = "";
    for (const t of this.match.doraIndicators) dd.appendChild(this.tileEl(t, "tiny"));
  }

  renderPanels() {
    for (let s = 0; s < 4; s++) {
      const p = this.match.players[s];
      const el = $("panel-" + s);
      el.classList.toggle("turn", s === this.turnSeat);
      el.classList.toggle("dealer", s === this.match.dealer);
      const scoreCls = this.match.scores[s] < 0 ? "p-score neg" : "p-score";
      let html = `<div class="p-head"><span class="p-wind">${this.seatWindMark(s)}</span>` +
        `<span class="p-name">${p.name}</span>` +
        (p.riichi ? `<span class="riichi-badge">立直</span>` : "") +
        `<span class="${scoreCls}">${this.match.scores[s]}</span></div>`;
      el.innerHTML = html;
      if (s !== 0) {
        const hb = document.createElement("div");
        hb.className = "p-hand-back";
        for (let i = 0; i < p.hand.length; i++) hb.appendChild(this.backEl("tiny"));
        el.appendChild(hb);
      }
      const dc = document.createElement("div");
      dc.className = "discards";
      p.discards.forEach((t, i) => {
        const lastRiichi = p.riichi && this.riichiTileIdx[s] === i;
        dc.appendChild(this.tileEl(t, "tiny" + (lastRiichi ? " riichi-disc" : "")));
      });
      el.appendChild(dc);
      if (p.melds.length) {
        const mr = document.createElement("div");
        mr.className = "melds-row";
        for (const m of p.melds) {
          const g = document.createElement("div");
          g.className = "meld";
          for (const t of m.tiles) g.appendChild(this.tileEl(t, "tiny"));
          mr.appendChild(g);
        }
        el.appendChild(mr);
      }
    }
  }

  renderMyHand(hand, opts = {}) {
    const el = $("my-hand");
    el.innerHTML = "";
    const drawnIdx = opts.drawn >= 0 ? hand.lastIndexOf(opts.drawn) : -1;
    hand.forEach((t, i) => {
      const d = this.tileEl(t, (i === drawnIdx ? "drawn " : "") + (opts.locked ? "riichi-lock" : ""));
      if (!opts.locked && opts.clickable) {
        d.onclick = () => this.onHandClick(t);
      }
      el.appendChild(d);
    });
    const mm = $("my-melds");
    mm.innerHTML = "";
    for (const m of this.match.players[0].melds) {
      const g = document.createElement("div");
      g.className = "meld";
      for (const t of m.tiles) g.appendChild(this.tileEl(t, "small"));
      mm.appendChild(g);
    }
  }

  setActionBar(html) { $("action-bar").innerHTML = html || ""; }
  msg(t) { $("center-msg").textContent = t; }

  async banner(text, ms = 900) {
    const b = $("banner");
    b.textContent = text;
    b.classList.remove("hidden");
    beep(text.includes("和") ? 880 : 520, 0.15);
    await sleep(ms);
    b.classList.add("hidden");
  }

  /* ---------- 事件 ---------- */
  async onEvent(ev) {
    const m = this.match, M = this.M;
    switch (ev.t) {
      case "round_start":
        this.riichiTileIdx = [-1, -1, -1, -1];
        this.myDrawn = -1;
        this.renderTop(); this.renderPanels();
        this.renderMyHand(m.players[0].hand.slice().sort((a, b) => a - b), {});
        this.msg(`${ev.round} 开始`);
        await this.banner(ev.round + (ev.honba ? ` ${ev.honba}本场` : ""));
        break;
      case "draw":
        this.turnSeat = ev.seat;
        if (ev.seat === 0) this.myDrawn = ev.tile;
        this.renderTop(); this.renderPanels();
        if (ev.seat !== 0) { this.msg(`${m.players[ev.seat].name} 摸牌…`); await sleep(420); }
        break;
      case "discard": {
        if (this.riichiPending === ev.seat) {
          this.riichiTileIdx[ev.seat] = m.players[ev.seat].discards.length - 1;
          this.riichiPending = -1;
        }
        if (ev.seat === 0) this.myDrawn = -1;
        this.renderPanels();
        this.msg(`${m.players[ev.seat].name} 切 ${M.tileShort(ev.tile)}`);
        beep(300, 0.05);
        if (ev.seat !== 0) await sleep(360);
        break;
      }
      case "riichi":
        this.riichiPending = ev.seat;
        this.renderPanels();
        this.msg(`${m.players[ev.seat].name} 立直！`);
        await this.banner("立直！");
        break;
      case "pon": case "chi": case "kan": {
        const label = { pon: "碰！", chi: "吃！", kan: "杠！" }[ev.t];
        this.renderTop(); this.renderPanels();
        this.msg(`${m.players[ev.seat].name} ${label}`);
        await this.banner(label, 800);
        break;
      }
      case "rinshan":
        this.renderTop(); this.renderPanels();
        if (ev.seat !== 0) await sleep(400);
        break;
      case "win":
        this.renderTop(); this.renderPanels();
        await this.showWin(ev);
        break;
      case "exhaustive":
        this.renderTop(); this.renderPanels();
        await this.showExhaustive(ev);
        break;
      case "match_end":
        this.showMatchEnd(ev);
        break;
    }
  }

  /* ---------- 人类出牌 ---------- */
  chooseDiscard(seat, hand, opts) {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.riichiArmed = false;
      const locked = !!opts.locked;
      this.renderMyHand(hand, { clickable: !locked, locked, drawn: opts.drawn });
      const bar = [];
      const hint = locked ? "立直中…等待自摸/杠" : (this.riichiArmed ? "" : "点击手牌切出");
      if (opts.tsumo) bar.push(`<button class="act-btn win" data-act="tsumo">自摸！ ${opts.tsumo.han}翻</button>`);
      for (const k of (opts.kans || []))
        bar.push(`<button class="act-btn" data-act="kan" data-kind="${k.kind}" data-tile="${k.tile}">杠 ${this.M.tileShort(k.tile)}</button>`);
      if (opts.canRiichi) bar.push(`<button class="act-btn riichi-btn" data-act="riichi-arm">立直</button>`);
      if (locked) bar.push(`<button class="act-btn pass" data-act="pass">过</button>`);
      bar.push(`<div id="action-hint">${hint}</div>`);
      this.setActionBar(bar.join(""));
      this.bindActionButtons(opts);
      if (locked && !opts.tsumo && !(opts.kans || []).length) {
        // 立直后无事可做：自动切摸牌
        setTimeout(() => this.finish({ type: "discard", tile: opts.drawn }), 750);
      }
    });
  }

  bindActionButtons(opts) {
    $("action-bar").querySelectorAll("button").forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === "tsumo") this.finish({ type: "tsumo" });
        else if (act === "kan") this.finish({ type: "kan", kind: b.dataset.kind, tile: +b.dataset.tile });
        else if (act === "pass") this.finish({ type: "discard", tile: opts.drawn });
        else if (act === "riichi-arm") {
          this.riichiArmed = true;
          b.classList.add("armed");
          $("action-hint").textContent = "立直！请选择要切出的牌";
        }
      };
    });
  }

  onHandClick(t) {
    if (this.riichiArmed) this.finish({ type: "riichi", tile: t });
    else this.finish({ type: "discard", tile: t });
  }

  /* ---------- 人类副露/荣和 ---------- */
  chooseCall(seat, tile, fromSeat, options) {
    return new Promise(resolve => {
      this.resolve = resolve;
      const bar = options.map((o, i) =>
        `<button class="act-btn ${o.type === "ron" ? "win" : ""}" data-i="${i}">${o.label}</button>`).join("") +
        `<button class="act-btn pass" data-i="-1">跳过</button>` +
        `<div id="action-hint">${this.match.players[fromSeat].name} 打出 ${this.M.tileShort(tile)}，请选择</div>`;
      this.setActionBar(bar);
      beep(660, 0.1);
      $("action-bar").querySelectorAll("button").forEach(b => {
        b.onclick = () => {
          const i = +b.dataset.i;
          this.finish(i < 0 ? null : options[i]);
        };
      });
    });
  }

  finish(val) {
    this.setActionBar("");
    const r = this.resolve;
    this.resolve = null;
    this.riichiArmed = false;
    if (r) r(val);
  }

  /* ---------- 弹窗 ---------- */
  modal(html) {
    return new Promise(resolve => {
      $("modal-box").innerHTML = html + `<br><button class="modal-btn" id="modal-ok">继续</button>`;
      $("modal").classList.remove("hidden");
      $("modal-ok").onclick = () => { $("modal").classList.add("hidden"); resolve(); };
    });
  }

  async showWin(ev) {
    const m = this.match;
    const wname = m.players[ev.winner].name;
    const kind = ev.fromSeat === null ? "自摸" : "荣和";
    beep(880, 0.2); setTimeout(() => beep(1174, 0.25), 150);
    await this.banner(`${wname} ${kind}！`, 1100);
    const yaku = ev.yaku.map(([n, h]) => `<div class="yaku-row"><span>${n}</span><b>${h}翻</b></div>`).join("");
    const delta = m.scores.map((s, i) => `${m.players[i].name} ${s}`).join(" · ");
    await this.modal(`
      <h2>${kind}</h2>
      <div class="win-sub">${wname} · 打出牌 ${this.M.tileShort(ev.tile)}</div>
      ${yaku}
      <div class="win-points">${ev.han}翻 ${ev.fu}符 · ${ev.points}点${ev.renchan ? " · 连庄" : ""}</div>
      <div class="score-delta">${delta}</div>`);
  }

  async showExhaustive(ev) {
    const m = this.match;
    await this.banner("流局", 1000);
    const rows = ev.tenpai.map((t, i) =>
      `<div class="yaku-row"><span>${m.players[i].name}</span><b>${t ? "听牌✓" : "未听"}</b></div>`).join("");
    await this.modal(`<h2>流局</h2><div class="win-sub">荒牌流局 · ${ev.renchan ? "庄家听牌连庄" : "轮庄"}</div>${rows}`);
  }

  showMatchEnd(ev) {
    const m = this.match;
    const medals = ["🥇", "🥈", "🥉", "4"];
    const rows = ev.ranking.map((s, i) =>
      `<div class="rank-row ${s === 0 ? "me" : ""}"><span class="r">${medals[i]}</span>` +
      `<span>${m.players[s].name}</span><span class="sc">${ev.scores[s]}</span></div>`).join("");
    $("modal-box").innerHTML = `<h2>终局</h2><div class="win-sub">${ev.reason}</div>${rows}<br>
      <button class="modal-btn" onclick="location.reload()">再来一局</button>`;
    $("modal").classList.remove("hidden");
    this.msg("对局结束");
  }
}

/* ---------- 启动 ---------- */
(function boot() {
  // 模块自检：任一脚本没加载成功就直接在标题屏报错，而不是点开始没反应
  const missing = ["Mahjong", "MahjongAI", "MahjongMatch"].filter(k => !window[k]);
  if (missing.length) {
    document.querySelector(".title-foot").innerHTML =
      `<p style="color:#ff8a8a">⚠️ 游戏模块加载失败（${missing.join(", ")}），请刷新重试</p>`;
    document.getElementById("btn-start").disabled = true;
    return;
  }
  let lv = 2;
  document.querySelectorAll(".diff-btn").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".diff-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      lv = +b.dataset.lv;
      beep(520, 0.06);
    };
  });
  $("btn-start").onclick = async () => {
    beep(660, 0.1);
    $("screen-title").classList.add("hidden");
    $("screen-game").classList.remove("hidden");
    const match = new window.MahjongMatch.Match({ aiLevels: [0, lv, lv, lv], humanSeat: 0 });
    const ui = new BrowserUI(match);
    try {
      await match.play(ui);
    } catch (e) {
      console.error(e);
      ui.msg("对局出现异常，请刷新重试");
      ui.setActionBar(`<div id="action-hint" style="color:#ff8a8a">出错了：${(e && e.message) || e}，请刷新页面</div>`);
    }
  };
})();
