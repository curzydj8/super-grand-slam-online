"""认证 API：注册 / 登录 / JWT。"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from .deps import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGO = "HS256"
EXPIRE_MIN = 60 * 24 * 7


class RegisterIn(BaseModel):
    username: str
    password: str
    nickname: str = ""


class LoginIn(BaseModel):
    username: str
    password: str


def make_token(uid: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode({"sub": str(uid), "exp": exp}, SECRET, algorithm=ALGO)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer),
                     db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录")
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token 无效")
    user = db.get(User, uid)
    if not user or user.status == 0:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在或被封禁")
    return user


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if len(body.username) < 3 or len(body.password) < 6:
        raise HTTPException(400, "用户名至少3位，密码至少6位")
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(400, "用户名已存在")
    user = User(username=body.username,
                password_hash=pwd.hash(body.password),
                nickname=body.nickname or body.username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "data": {"token": make_token(user.id), "uid": user.id}}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not pwd.verify(body.password, user.password_hash):
        raise HTTPException(401, "用户名或密码错误")
    if user.status == 0:
        raise HTTPException(403, "账号已被封禁")
    return {"success": True, "data": {
        "token": make_token(user.id),
        "user": {"uid": user.id, "nickname": user.nickname, "level": user.level,
                 "gold": user.gold, "diamond": user.diamond,
                 "rank": user.rank_name},
    }}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"success": True, "data": {
        "uid": user.id, "nickname": user.nickname, "level": user.level,
        "exp": user.exp, "gold": user.gold, "diamond": user.diamond,
        "rank": user.rank_name, "rank_score": user.rank_score,
        "win_count": user.win_count, "match_count": user.match_count,
        "max_win_streak": user.max_win_streak,
    }}
