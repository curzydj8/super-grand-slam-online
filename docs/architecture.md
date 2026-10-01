# 系统架构 v1.0

## 前端（frontend/）

```
src/
├── main.ts          # 入口：Vue + Pinia + Router
├── router.ts        # /login /lobby /game/:roomId /rank
├── stores/
│   ├── user.ts      # 登录态、用户信息（Pinia）
│   └── game.ts      # 对局状态：手牌/比分/出牌动作
├── pages/           # Login / Lobby / Game / Rank
├── components/
│   └── MahjongTable.vue  # PixiJS 牌桌（桌布层）+ DOM 手牌（MVP）
└── assets/main.css
```

- Vue3 负责页面（登录/大厅/排行/商城），PixiJS 只负责麻将桌渲染。
- MVP：手牌用 DOM 保证可玩；Phase 2 牌桌全量 PixiJS 化（牌墙动画、摸打动画、立直棒）。

## 后端（backend/app/）

```
app/
├── main.py            # FastAPI 入口，挂载路由 + WS
├── core/              # ★ 规则引擎（纯函数，无外部依赖）
│   ├── mahjong.py     # 编码/洗牌/发牌/胡牌/向听/番种/符点数
│   └── ai.py          # LV1-LV4
├── api/               # auth/lobby/rank/misc（shop/task/mail/admin）
├── models/            # SQLAlchemy（以 database/schema.sql 为准）
├── services/game.py   # 对局状态机（单机AI；多人复用）
└── websocket/         # 协议定义 + 连接管理
```

- 规则引擎是唯一事实源：docs/rules.md → mahjong.py → 所有上层。
- 对局判定（可否吃碰胡、番种、点数）全部在服务端计算，前端只做展示。

## 数据

- MySQL：用户/对局记录/任务/商城/邮件/公告（database/schema.sql）。
- Redis：房间状态、匹配队列、排行榜缓存、JWT 黑名单（Phase 2 接入）。

## 部署（deploy/）

Nginx（80/443）→ 前端静态 / 后端:8000（/api, /ws）。
详见 docs/deployment.md。
