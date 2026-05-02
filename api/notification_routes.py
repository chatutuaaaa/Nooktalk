from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session

from .auth_routes import get_current_user
from .db import get_db
from .models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _out(n: Notification, actor_name: str) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "actorUsername": actor_name,
        "postId": n.post_id,
        "commentId": n.comment_id,
        "postTitle": n.post_title,
        "snippet": n.snippet,
        "read": n.read_at is not None,
        "createdAt": _to_ms(n.created_at),
    }


@router.get("")
def list_notifications(
    limit: int = Query(default=40, ge=1, le=100),
    unread_only: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    q = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    q = q.order_by(desc(Notification.created_at)).limit(limit)
    rows = db.scalars(q).all()
    if not rows:
        return {"ok": True, "items": []}
    actor_ids = {r.actor_id for r in rows}
    actors = {
        u.id: u.username
        for u in db.scalars(select(User).where(User.id.in_(actor_ids))).all()
    }
    items = [_out(r, actors.get(r.actor_id, "用户")) for r in rows]
    return {"ok": True, "items": items}


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    n = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return {"ok": True, "count": int(n or 0)}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="消息不存在")
    if row.read_at is None:
        row.read_at = _utcnow()
        db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    now = _utcnow()
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    db.commit()
    return {"ok": True}
