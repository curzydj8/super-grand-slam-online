# Super Grand Slam Online（超级大满贯 Online）

经典街机麻将 × 网页游戏 × AI 对战 × 成长养成 × 赛事系统。

- 前端：Vue3 + TypeScript + Vite + Pinia + PixiJS（Vue 做页面，PixiJS 做麻将桌）
- 后端：Python FastAPI + SQLAlchemy + Redis + MySQL
- 部署：Nginx + Docker + Ubuntu

## 规则文档（先定规则，再写代码）

**[docs/rules.md](docs/rules.md)** —— 日本立直麻将规则：牌型、番种、符数、计分、胡牌判定、向听数。
它是所有代码实现的唯一依据，`backend/app/core/mahjong.py` 是它的可执行版本（47 项单元测试全过）。

## 目录

```
super-grand-slam-online
├── frontend/     # Vue3 + TS + Pinia + PixiJS
├── backend/      # FastAPI（app/core 规则引擎 / api / models / services / websocket）
├── database/     # schema.sql（MySQL，以此为准）
├── docs/         # rules.md / api.md / websocket.md / architecture.md / deployment.md
└── deploy/       # docker-compose.yml / nginx.conf
```

## 快速开始

```bash
# 规则引擎测试（零依赖）
python3 backend/tests/test_mahjong.py

# 后端
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# 前端
cd frontend && npm install && npm run dev
```

## 项目总纲（Master Prompt）

> Build a large-scale web-based mahjong game inspired by classic arcade mahjong games.
>
> Requirements:
> - Vue3 + TypeScript + PixiJS frontend
> - Python FastAPI backend
> - MySQL database
> - Redis cache
> - WebSocket real-time multiplayer
>
> Modules: User System, Login System, Gold System, Task System, Achievement System,
> Rank System, AI Opponent System, Matchmaking System, Tournament System,
> Leaderboard System, Shop System, Mail System, Admin Panel.
>
> Implement complete mahjong logic including: Tile Encoding, Shuffle Algorithm,
> Deal Algorithm, Meld Detection, Winning Hand Detection, Shanten Calculation,
> Scoring System, AI Decision Making.
>
> Generate: project structure, database schema, API design, websocket protocol,
> frontend architecture, backend architecture, deployment guide.

## MVP（3 个月）

登录 / 大厅 / 单机 AI（LV1-LV4）/ 麻将对局 / 胡牌判定 / 金币 / 排行榜。
