# API 设计 v1.0

Base URL：`http://host:8000`。统一返回 `{success: true, data}` / `{success: false, error}`。
认证：`Authorization: Bearer <JWT>`（除注册/登录外均需）。

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/auth/register | {username, password, nickname} → {token, uid} |
| POST | /api/auth/login | {username, password} → {token, user} |
| GET | /api/auth/me | 当前用户信息（含金币/钻石/段位/战绩） |

user 对象：`{uid, nickname, level, gold, diamond, rank}`，rank ∈ 新手/雀士/雀杰/雀豪/雀圣/雀神。

## 对局（MVP：单机 AI 走 REST，Phase 2 全量 WS 化）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/match/create | {mode:"ai", ai_level:1-4} → {room_id, hand, dealer, scores} |
| GET | /api/match/{room_id}/state | 手牌/副露/牌河/比分/轮到谁 |
| POST | /api/match/{room_id}/discard | {tile} → 出牌事件 + AI 行动 + 补摸 |
| GET | /api/records | 最近 20 场对局记录 |

## 排行榜

GET /api/rank/{gold|winrate|rank|streak}?limit=50

## 商城 / 任务 / 邮件

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/shop/items | 装饰类商品（头像/框/桌布/牌背/特效/称号，不卖数值） |
| POST | /api/shop/buy/{item_id} | TODO Phase 2 |
| GET | /api/tasks/daily | 每日任务进度 |
| GET | /api/mails | 邮件列表（含全服邮件） |

## 管理（需 is_admin）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/admin/users | 用户列表 |
| POST | /api/admin/announcements | 发布公告 |

TODO Phase 2：封禁管理、活动管理、邮件群发。
