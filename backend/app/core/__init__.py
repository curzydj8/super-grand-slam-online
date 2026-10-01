"""麻将核心：规则引擎（mahjong.py）与 AI（ai.py）。纯函数，无外部依赖。"""
from .mahjong import (
    create_wall, deal, is_winning, shanten, check_agari,
    calculate_score, detect_yaku, ukeire_count,
    EAST, SOUTH, WEST, NORTH, HAKU, HATSU, CHUN,
    WinContext, Meld,
)
from .ai import MahjongAI

__all__ = [
    "create_wall", "deal", "is_winning", "shanten", "check_agari",
    "calculate_score", "detect_yaku", "ukeire_count",
    "EAST", "SOUTH", "WEST", "NORTH", "HAKU", "HATSU", "CHUN",
    "WinContext", "Meld", "MahjongAI",
]
