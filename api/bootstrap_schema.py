"""开发/单机环境无 Alembic 时的列兜底（PostgreSQL）；生产建议使用 Alembic。"""
from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.engine import Engine


def ensure_community_columns(engine: Engine) -> None:
    if engine.url.get_backend_name() != "postgresql":
        return
    stmts = [
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT false""",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS is_silenced BOOLEAN NOT NULL DEFAULT false""",
        """ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ""",
        "CREATE INDEX IF NOT EXISTS ix_posts_deleted_at ON posts (deleted_at)",
        """ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ""",
        """ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS cascade_hide BOOLEAN NOT NULL DEFAULT false""",
        """ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0""",
        "CREATE INDEX IF NOT EXISTS ix_post_comments_deleted_at ON post_comments (deleted_at)",
        """ALTER TABLE posts ADD COLUMN IF NOT EXISTS topics VARCHAR(500) DEFAULT ''""",
        "ALTER TABLE posts ALTER COLUMN body TYPE TEXT USING body::TEXT",
        """ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)""",
        # 头像可存 data URL，放宽为 TEXT（已有列时尝试改类型）
        """ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT USING avatar_url::TEXT""",
    ]
    with engine.begin() as conn:
        for sql in stmts:
            try:
                conn.execute(text(sql))
            except Exception:
                pass


def bootstrap_promote_superuser(engine: Engine, username_or_email: str | None) -> None:
    if not username_or_email or not username_or_email.strip():
        return
    from .models import User

    needle = username_or_email.strip().lower()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db: Session = SessionLocal()
    try:
        u = db.scalar(select(User).where(func.lower(User.username) == needle))
        if u is None:
            u = db.scalar(select(User).where(func.lower(User.email) == needle))
        if u is None:
            return
        u.is_superuser = True
        db.commit()
    finally:
        db.close()
