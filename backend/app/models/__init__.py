"""SQLAlchemy 数据模型。建表 SQL 见 database/schema.sql（以 schema.sql 为准）。"""
from sqlalchemy import (BigInteger, Boolean, Column, DateTime, Enum, ForeignKey,
                        Integer, JSON, String, Text, func)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(32), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    nickname = Column(String(32), nullable=False)
    avatar = Column(String(255), default="")
    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    gold = Column(Integer, default=10000)
    diamond = Column(Integer, default=0)
    rank_score = Column(Integer, default=0)          # 段位分
    rank_name = Column(String(16), default="新手")    # 段位名
    win_count = Column(Integer, default=0)
    match_count = Column(Integer, default=0)
    max_win_streak = Column(Integer, default=0)
    status = Column(Integer, default=1)              # 1正常 0封禁
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class MatchRecord(Base):
    """对局记录（需求字段：id/room_id/players/winner/score/start_time/end_time）。"""
    __tablename__ = "match_record"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    room_id = Column(String(64), nullable=False)
    mode = Column(String(16), default="ai")          # ai=单机AI, rank=段位场, casual=休闲场
    players = Column(JSON, nullable=False)           # [{uid, nickname, score, rank}]
    winner = Column(BigInteger, ForeignKey("users.id"))
    score = Column(JSON)                             # 结算明细 {uid: 点数变动}
    rounds = Column(Integer, default=8)
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    kind = Column(String(16), default="daily")       # daily=每日 achievement=成就
    target = Column(Integer, default=1)
    reward_gold = Column(Integer, default=0)
    reward_diamond = Column(Integer, default=0)


class UserTask(Base):
    __tablename__ = "user_tasks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    progress = Column(Integer, default=0)
    claimed = Column(Boolean, default=False)
    date = Column(String(10), default="")            # 每日任务日期 YYYY-MM-DD


class ShopItem(Base):
    __tablename__ = "shop_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    kind = Column(String(32), nullable=False)        # avatar/frame/table/cloth/back/effect/title
    price_gold = Column(Integer, default=0)
    price_diamond = Column(Integer, default=0)


class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("shop_items.id"), nullable=False)
    equipped = Column(Boolean, default=False)


class Mail(Base):
    __tablename__ = "mails"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)  # 0=全服
    title = Column(String(128), nullable=False)
    body = Column(Text, default="")
    attachments = Column(JSON, default=list)         # [{gold, diamond, item_id}]
    read = Column(Boolean, default=False)
    claimed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(128), nullable=False)
    body = Column(Text, default="")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
