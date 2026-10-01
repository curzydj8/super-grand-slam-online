"""商城 / 任务 / 邮件 / 公告 / 管理 API（MVP 骨架，Phase 2 补全业务逻辑）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..models import Announcement, Mail, ShopItem, User
from .auth import get_current_user
from .deps import get_db

shop_router = APIRouter(prefix="/api/shop", tags=["shop"])
task_router = APIRouter(prefix="/api/tasks", tags=["tasks"])
mail_router = APIRouter(prefix="/api/mails", tags=["mails"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User):
    from fastapi import HTTPException
    if not user.is_admin:
        raise HTTPException(403, "需要管理员权限")


@shop_router.get("/items")
def shop_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(ShopItem).all()
    return {"success": True, "data": [
        {"id": i.id, "code": i.code, "name": i.name, "kind": i.kind,
         "price_gold": i.price_gold, "price_diamond": i.price_diamond} for i in items]}


@shop_router.post("/buy/{item_id}")
def buy(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # TODO Phase 2：扣费、发道具（仅装饰类，不影响胜率）
    return {"success": False, "error": "TODO: 商城购买 Phase 2 实现"}


@task_router.get("/daily")
def daily_tasks(user: User = Depends(get_current_user)):
    # TODO Phase 2：完成3局/胡牌5次/1000金币
    return {"success": True, "data": []}


@mail_router.get("")
def mails(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Mail).filter(
        (Mail.user_id == user.id) | (Mail.user_id == 0)
    ).order_by(Mail.id.desc()).limit(30).all()
    return {"success": True, "data": [
        {"id": m.id, "title": m.title, "body": m.body, "read": m.read,
         "claimed": m.claimed} for m in rows]}


@admin_router.get("/users")
def admin_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    rows = db.query(User).order_by(User.id.desc()).limit(100).all()
    return {"success": True, "data": [
        {"uid": u.id, "username": u.username, "nickname": u.nickname,
         "status": u.status, "gold": u.gold} for u in rows]}


@admin_router.post("/announcements")
def create_announcement(body: dict, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    _require_admin(user)
    a = Announcement(title=body["title"], body=body.get("body", ""),
                     pinned=bool(body.get("pinned")))
    db.add(a)
    db.commit()
    return {"success": True, "data": {"id": a.id}}
