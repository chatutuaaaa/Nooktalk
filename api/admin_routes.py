from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .auth_routes import get_current_admin
from .db import get_db
from .models import AuditLog, CommentLike, Post, PostComment, PostLike, User

router = APIRouter(prefix="/admin", tags=["admin"])


class SilenceIn(BaseModel):
    silenced: bool


def _day_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


def _log_audit(db: Session, actor_id: int, action: str, target_text: str = "") -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_text=(target_text or "")[:500],
        )
    )


@router.get("/stats")
def admin_stats(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)) -> dict:
    total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    total_posts = int(
        db.scalar(select(func.count()).select_from(Post).where(Post.deleted_at.is_(None))) or 0
    )
    total_comments = int(
        db.scalar(select(func.count()).select_from(PostComment).where(PostComment.deleted_at.is_(None)))
        or 0
    )
    silenced = int(db.scalar(select(func.count()).select_from(User).where(User.is_silenced.is_(True))) or 0)
    likes_posts = int(db.scalar(select(func.count()).select_from(PostLike)) or 0)
    likes_comments = int(db.scalar(select(func.count()).select_from(CommentLike)) or 0)
    t0 = _day_start_utc()
    new_users_today = int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= t0)) or 0)
    new_posts_today = int(
        db.scalar(
            select(func.count()).select_from(Post).where(
                Post.created_at >= t0,
                Post.deleted_at.is_(None),
            )
        )
        or 0
    )
    new_comments_today = int(
        db.scalar(
            select(func.count()).select_from(PostComment).where(
                PostComment.created_at >= t0,
                PostComment.deleted_at.is_(None),
            )
        )
        or 0
    )

    return {
        "ok": True,
        "totals": {
            "users": total_users,
            "posts": total_posts,
            "comments": total_comments,
            "likes": likes_posts + likes_comments,
            "silencedUsers": silenced,
        },
        "today": {
            "newUsers": new_users_today,
            "newPosts": new_posts_today,
            "newComments": new_comments_today,
        },
    }


@router.get("/users")
def admin_list_users(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    q = (
        select(User)
        .order_by(desc(User.id))
        .offset(offset)
        .limit(limit)
    )
    rows = db.scalars(q).all()
    total = int(db.scalar(select(func.count()).select_from(User)) or 0)
    items = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "isSilenced": getattr(u, "is_silenced", False),
            "isSuperuser": getattr(u, "is_superuser", False),
            "createdAt": int(u.created_at.timestamp() * 1000)
            if getattr(u, "created_at", None)
            else None,
        }
        for u in rows
    ]
    return {"ok": True, "total": total, "items": items}


@router.patch("/users/{user_id}/silence")
def admin_set_silence(
    user_id: int,
    payload: SilenceIn,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="不能调整自己的禁言状态")
    if getattr(target, "is_superuser", False):
        raise HTTPException(status_code=400, detail="不支持禁言其他管理员")
    prev = bool(target.is_silenced)
    target.is_silenced = payload.silenced
    if prev != payload.silenced:
        _log_audit(
            db,
            admin.id,
            "silence_set" if payload.silenced else "silence_clear",
            f"user#{user_id}",
        )
    db.commit()
    db.refresh(target)
    return {
        "ok": True,
        "user": {
            "id": target.id,
            "username": target.username,
            "isSilenced": target.is_silenced,
        },
    }
