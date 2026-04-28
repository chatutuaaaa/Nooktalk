"""软删满 30 天未恢复则物理删除（帖、评分别处理，见 ISSUE §5）。"""
from __future__ import annotations

from datetime import timedelta, timezone

from sqlalchemy import delete

from .db import SessionLocal
from .models import Post, PostComment


def utcnow():
    from datetime import datetime

    return datetime.now(timezone.utc)


def run_purge_once() -> dict[str, int]:
    """返回本次删除行数（估算）。"""
    cutoff = utcnow() - timedelta(days=30)
    db = SessionLocal()
    n_comment = 0
    n_post = 0
    try:
        r1 = db.execute(
            delete(PostComment).where(
                PostComment.deleted_at.is_not(None),
                PostComment.deleted_at < cutoff,
                PostComment.cascade_hide.is_(False),
            )
        )
        n_comment = r1.rowcount or 0

        r2 = db.execute(
            delete(Post).where(
                Post.deleted_at.is_not(None),
                Post.deleted_at < cutoff,
            )
        )
        n_post = r2.rowcount or 0

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return {"deletedComments": int(n_comment), "deletedPosts": int(n_post)}
