from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # 自定义头像：https 链接或前端压缩后的 data:image/*;base64,；为空时前端用默认头像
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )

    # 管理员 / 禁言（禁言仅限发帖与评论）
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_silenced: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class Notification(Base):
    """站内消息：他人点赞/评论自己的帖子。"""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)  # post_like | post_comment
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    comment_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    post_title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    snippet: Mapped[str] = mapped_column(Text, default="", server_default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow, index=True
    )


class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    note: Mapped[str] = mapped_column(String(1000), default="")
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), index=True)
    body: Mapped[str] = mapped_column(Text)
    tag: Mapped[str] = mapped_column(String(20), index=True, default="闲聊")
    topics: Mapped[str] = mapped_column(String(500), default="")
    pinned: Mapped[bool] = mapped_column(default=False)
    views: Mapped[int] = mapped_column(default=0)
    comments_count: Mapped[int] = mapped_column(default=0)
    likes_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    # 软删：非空则对公开列表/详情不可见
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like_post_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )


class PostComment(Base):
    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # True：因帖子被软删而级联标记；帖子恢复时可一并撤销
    cascade_hide: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    likes_count: Mapped[int] = mapped_column(default=0, server_default="0")


class CommentLike(Base):
    __tablename__ = "comment_likes"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_like_comment_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("post_comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )


class AuditLog(Base):
    """管理员操作简要审计（按需扩展）"""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_text: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
