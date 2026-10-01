# WebSocket 协议 v1.0

连接：`ws://host:8000/ws/{room_id}/{seat}`。JSON 消息 `{type, ...}`。

## 客户端 → 服务端

| type | 字段 | 说明 |
|---|---|---|
| join | token | 加入房间（鉴权） |
| discard | tile | 出牌（0-33） |
| pon | — | 碰 |
| chi | tiles:[t1,t2] | 吃（与打出的牌组成顺子） |
| kan | kind | open/closed/added |
| ron | — | 荣和 |
| tsumo | — | 自摸 |
| riichi | tile | 立直宣言 + 打出 |
| chat | text | 聊天（200字内） |
| ping | — | 心跳 |

## 服务端 → 客户端

| type | 字段 | 说明 |
|---|---|---|
| joined | seat, players | 加入成功 |
| deal | hand, dealer, round_wind | 发牌（hand 仅自己可见） |
| draw | tile | 摸牌（仅自己可见，他人收到空 draw 通知） |
| discard | seat, tile | 某家出牌 |
| callable | actions | 可执行操作提示 [pon,chi,kan,ron] |
| pon/chi/kan | seat, tiles | 副露公示 |
| ron | winner, from, yaku, han, fu, score | 荣和结算 |
| tsumo | winner, yaku, han, fu, payments | 自摸结算 |
| riichi | seat | 立直 |
| round_end | scores, next_dealer | 单局结束 |
| match_end | ranking, rewards | 整场结束（含段位分/金币结算） |
| chat | seat, nickname, text | 聊天广播 |
| error | code, message | 错误 |
| pong | — | 心跳回应 |

## 状态

- MVP：对局主流程走 REST（/api/match/*），WS 仅用于聊天/心跳；Phase 2 全部切换到本协议。
- 断线：seat 保留 5 分钟，重连 join 同一 room_id/seat 恢复。
