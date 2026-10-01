"""WebSocket 协议：消息格式定义。详见 docs/websocket.md。"""
from __future__ import annotations

# 客户端 → 服务端
C_JOIN = "join"            # {room_id, token}
C_DISCARD = "discard"      # {tile}
C_PON = "pon"              # {}
C_CHI = "chi"              # {tiles:[t1,t2]}
C_KAN = "kan"              # {kind: open|closed|added}
C_RON = "ron"              # {}
C_TSUMO = "tsumo"          # {}
C_RIICHI = "riichi"        # {tile}
C_CHAT = "chat"            # {text}
C_PING = "ping"            # {}

# 服务端 → 客户端
S_JOINED = "joined"        # {seat, players}
S_DEAL = "deal"            # {hand, dealer, round_wind}
S_DRAW = "draw"            # {tile} 仅自己可见
S_DISCARD = "discard"      # {seat, tile}
S_CALLABLE = "callable"    # {actions:[pon,chi,kan,ron]} 可吃碰杠胡提示
S_PON = "pon"              # {seat, tiles}
S_RON = "ron"              # {winner, from, yaku, han, fu, score}
S_TSUMO = "tsumo"          # {winner, yaku, han, fu, payments}
S_RIICHI = "riichi"        # {seat}
S_ROUND_END = "round_end"  # {scores, next_dealer}
S_MATCH_END = "match_end"  # {ranking, rewards}
S_CHAT = "chat"            # {seat, nickname, text}
S_ERROR = "error"          # {code, message}
S_PONG = "pong"            # {}


def make_msg(type_: str, **payload) -> dict:
    return {"type": type_, **payload}
