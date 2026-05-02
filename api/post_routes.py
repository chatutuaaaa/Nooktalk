from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .auth_routes import get_current_user, get_current_user_writer, get_optional_user
from .db import get_db
from .models import CommentLike, Notification, Post, PostComment, PostLike, User

router = APIRouter(prefix="/posts", tags=["posts"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _post_out(post: Post, author_name: str) -> dict:
    excerpt = (post.body or "").strip()
    if len(excerpt) > 90:
        excerpt = excerpt[:90].rstrip() + "..."
    return {
        "id": post.id,
        "authorId": post.author_id,
        "title": post.title,
        "author": author_name,
        "tag": post.tag,
        "topics": [s for s in (post.topics or "").split(",") if s],
        "excerpt": excerpt,
        "body": post.body,
        "pinned": post.pinned,
        "deleted": post.deleted_at is not None,
        "createdAt": _to_ms(post.created_at),
        "stats": {
            "views": post.views,
            "comments": post.comments_count,
            "likes": post.likes_count,
        },
    }


class CreatePostIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=100_000)
    tag: str = Field(min_length=1, max_length=20)
    topics: list[str] = Field(default_factory=list)


class UpdatePostIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=100_000)
    tag: str = Field(min_length=1, max_length=20)
    topics: list[str] = Field(default_factory=list)


class CreateCommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


def _comment_out(
    comment: PostComment,
    author_name: str,
    *,
    liked_by_me: bool,
) -> dict:
    return {
        "id": comment.id,
        "postId": comment.post_id,
        "authorId": comment.user_id,
        "author": author_name,
        "content": comment.content,
        "createdAt": _to_ms(comment.created_at),
        "likes": comment.likes_count,
        "likedByMe": liked_by_me,
    }


def _can_modify_post(user: User, post: Post) -> bool:
    return bool(getattr(user, "is_superuser", False)) or post.author_id == user.id


def _can_modify_comment(user: User, comment: PostComment) -> bool:
    return bool(getattr(user, "is_superuser", False)) or comment.user_id == user.id


@router.get("")
def list_posts(
    tag: str = Query(default="全部"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    q = (
        select(Post)
        .where(Post.deleted_at.is_(None))
        .order_by(desc(Post.pinned), desc(Post.created_at))
    )
    tag_norm = (tag or "全部").strip()
    if tag_norm and tag_norm not in ("全部", "热门"):
        q = q.where(Post.tag == tag_norm)
    rows = db.scalars(q.offset(offset).limit(limit)).all()
    author_ids = {r.author_id for r in rows}
    if author_ids:
        authors = {
            u.id: u.username
            for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()
        }
    else:
        authors = {}
    items = [_post_out(r, authors.get(r.author_id, "未知用户")) for r in rows]
    if tag_norm == "热门":
        items.sort(
            key=lambda x: (
                x["stats"]["comments"] * 3
                + x["stats"]["likes"] * 2
                + x["stats"]["views"]
            ),
            reverse=True,
        )
    return {"ok": True, "items": items}


@router.get("/hot")
def list_hot_posts_by_views(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> dict:
    """未删除帖子中按总浏览量降序的 TOP N。"""
    rows = db.scalars(
        select(Post)
        .where(Post.deleted_at.is_(None))
        .order_by(desc(Post.views), desc(Post.id))
        .limit(limit)
    ).all()
    if not rows:
        return {"ok": True, "items": []}
    author_ids = {r.author_id for r in rows}
    authors = {
        u.id: u.username
        for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()
    }
    items = [_post_out(r, authors.get(r.author_id, "未知用户")) for r in rows]
    return {"ok": True, "items": items}


def _likes_received_on_my_posts(db: Session, user: User, limit: int) -> dict:
    """他人对我帖子的每一次点赞（含自己点赞自己的记录），按时间倒序。"""
    rows = db.execute(
        select(
            PostLike.id.label("like_id"),
            PostLike.user_id,
            PostLike.created_at,
            Post.id.label("post_id"),
            Post.title,
            Post.deleted_at,
        )
        .select_from(PostLike)
        .join(Post, Post.id == PostLike.post_id)
        .where(Post.author_id == user.id)
        .order_by(desc(PostLike.created_at))
        .limit(limit)
    ).all()
    if not rows:
        return {"ok": True, "items": []}
    liker_ids = {r.user_id for r in rows}
    names = {
        u.id: u.username
        for u in db.scalars(select(User).where(User.id.in_(liker_ids))).all()
    }
    items = [
        {
            "id": int(r.like_id),
            "actorUsername": names.get(r.user_id, "用户"),
            "postId": int(r.post_id),
            "postTitle": (r.title or "")[:200],
            "postDeleted": r.deleted_at is not None,
            "createdAt": _to_ms(r.created_at),
        }
        for r in rows
    ]
    return {"ok": True, "items": items}


def _comments_received_on_my_posts(db: Session, user: User, limit: int) -> dict:
    """他人（及自己）在我帖子下的评论，未删除的评论，按时间倒序。"""
    rows = db.execute(
        select(
            PostComment.id.label("comment_id"),
            PostComment.user_id,
            PostComment.content,
            PostComment.created_at,
            Post.id.label("post_id"),
            Post.title,
            Post.deleted_at,
        )
        .select_from(PostComment)
        .join(Post, Post.id == PostComment.post_id)
        .where(Post.author_id == user.id, PostComment.deleted_at.is_(None))
        .order_by(desc(PostComment.created_at))
        .limit(limit)
    ).all()
    if not rows:
        return {"ok": True, "items": []}
    author_ids = {r.user_id for r in rows}
    names = {
        u.id: u.username
        for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()
    }
    items = []
    for r in rows:
        raw = (r.content or "").strip()
        snippet = raw[:160] + ("…" if len(raw) > 160 else "")
        items.append(
            {
                "id": int(r.comment_id),
                "actorUsername": names.get(r.user_id, "用户"),
                "postId": int(r.post_id),
                "postTitle": (r.title or "")[:200],
                "postDeleted": r.deleted_at is not None,
                "snippet": snippet,
                "createdAt": _to_ms(r.created_at),
            }
        )
    return {"ok": True, "items": items}


@router.get("/mine")
def list_my_posts(
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    interaction: Literal["likes", "comments"] | None = Query(
        default=None,
        description="为 likes/comments 时返回收到的赞/收到的评论明细，与帖子列表互斥",
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if interaction == "likes":
        return _likes_received_on_my_posts(db, user, limit)
    if interaction == "comments":
        return _comments_received_on_my_posts(db, user, limit)
    q = (
        select(Post)
        .where(Post.author_id == user.id)
        .order_by(desc(Post.created_at))
    )
    if not include_deleted:
        q = q.where(Post.deleted_at.is_(None))
    rows = db.scalars(q.offset(offset).limit(limit)).all()
    items = [_post_out(r, user.username) for r in rows]
    return {"ok": True, "items": items}


# 兼容旧路径（部分反向代理对 /mine/xxx 子路径处理异常时，请用 /mine?interaction=likes）
@router.get("/mine/received-likes")
def list_likes_received_on_my_posts_alias(
    limit: int = Query(default=100, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return _likes_received_on_my_posts(db, user, limit)


@router.get("/mine/received-comments")
def list_comments_received_on_my_posts_alias(
    limit: int = Query(default=100, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return _comments_received_on_my_posts(db, user, limit)


@router.get("/{post_id}")
def get_post_detail(
    post_id: int,
    increment_view: bool = Query(default=True),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")

    if post.deleted_at is not None:
        if user is None:
            raise HTTPException(status_code=404, detail="帖子不存在")
        if not (user.is_superuser or post.author_id == user.id):
            raise HTTPException(status_code=404, detail="帖子不存在")
        increment_view = False

    author = db.get(User, post.author_id)

    if increment_view and post.deleted_at is None:
        post.views += 1
        db.commit()
        db.refresh(post)

    comments = db.scalars(
        select(PostComment)
        .where(
            PostComment.post_id == post_id,
            PostComment.deleted_at.is_(None),
        )
        .order_by(PostComment.created_at.asc())
    ).all()
    comment_user_ids = {c.user_id for c in comments}
    if comment_user_ids:
        comment_authors = {
            u.id: u.username
            for u in db.scalars(select(User).where(User.id.in_(comment_user_ids))).all()
        }
    else:
        comment_authors = {}

    liked_by_me = False
    if user is not None:
        liked_by_me = (
            db.scalar(
                select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
            )
            is not None
        )

    liked_comment_ids: set[int] = set()
    if user is not None and comments:
        cids = [c.id for c in comments]
        for row in db.scalars(
            select(CommentLike).where(
                CommentLike.user_id == user.id,
                CommentLike.comment_id.in_(cids),
            )
        ).all():
            liked_comment_ids.add(row.comment_id)

    return {
        "ok": True,
        "item": _post_out(post, author.username if author else "未知用户"),
        "likedByMe": liked_by_me,
        "comments": [
            _comment_out(
                c,
                comment_authors.get(c.user_id, "未知用户"),
                liked_by_me=c.id in liked_comment_ids,
            )
            for c in comments
        ],
    }


@router.post("")
def create_post(
    payload: CreatePostIn,
    user: User = Depends(get_current_user_writer),
    db: Session = Depends(get_db),
) -> dict:
    title = payload.title.strip()
    body = payload.body.strip()
    tag = payload.tag.strip() or "闲聊"
    if tag not in {"热门", "技术", "生活", "灵感", "闲聊"}:
        tag = "闲聊"
    clean_topics = []
    for t in payload.topics:
        s = str(t or "").strip().lstrip("#")
        if not s:
            continue
        if len(s) > 20:
            s = s[:20]
        if s not in clean_topics:
            clean_topics.append(s)
        if len(clean_topics) >= 8:
            break
    if len(title) < 2 or len(body) < 2:
        raise HTTPException(status_code=400, detail="标题和正文至少 2 个字符")
    post = Post(
        author_id=user.id,
        title=title,
        body=body,
        tag=tag,
        topics=",".join(clean_topics),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"ok": True, "item": _post_out(post, user.username)}


@router.put("/{post_id}")
def update_post(
    post_id: int,
    payload: UpdatePostIn,
    user: User = Depends(get_current_user_writer),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if not _can_modify_post(user, post):
        raise HTTPException(status_code=403, detail="无权编辑该帖子")

    title = payload.title.strip()
    body = payload.body.strip()
    tag = payload.tag.strip() or "闲聊"
    if tag not in {"热门", "技术", "生活", "灵感", "闲聊"}:
        tag = "闲聊"
    clean_topics = []
    for t in payload.topics:
        s = str(t or "").strip().lstrip("#")
        if not s:
            continue
        if len(s) > 20:
            s = s[:20]
        if s not in clean_topics:
            clean_topics.append(s)
        if len(clean_topics) >= 8:
            break
    if len(title) < 2 or len(body) < 2:
        raise HTTPException(status_code=400, detail="标题和正文至少 2 个字符")

    # 仅覆盖可编辑内容字段，互动数据（点赞/评论/浏览）保持不变
    post.title = title
    post.body = body
    post.tag = tag
    post.topics = ",".join(clean_topics)
    db.commit()
    db.refresh(post)
    author = db.get(User, post.author_id)
    return {"ok": True, "item": _post_out(post, author.username if author else "未知用户")}


@router.delete("/{post_id}")
def soft_delete_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if not _can_modify_post(user, post):
        raise HTTPException(status_code=403, detail="无权删除该帖子")
    now = _utcnow()
    for c in db.scalars(
        select(PostComment).where(PostComment.post_id == post_id, PostComment.deleted_at.is_(None))
    ).all():
        c.deleted_at = now
        c.cascade_hide = True
    post.deleted_at = now
    post.comments_count = 0
    db.commit()
    return {"ok": True}


@router.post("/{post_id}/restore")
def restore_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is None:
        raise HTTPException(status_code=404, detail="帖子无可恢复状态")
    if not _can_modify_post(user, post):
        raise HTTPException(status_code=403, detail="无权恢复该帖子")
    for c in db.scalars(
        select(PostComment).where(
            PostComment.post_id == post_id,
            PostComment.cascade_hide.is_(True),
        )
    ).all():
        c.deleted_at = None
        c.cascade_hide = False
    post.deleted_at = None
    n = db.scalar(
        select(func.count()).select_from(PostComment).where(
            PostComment.post_id == post_id,
            PostComment.deleted_at.is_(None),
        )
    )
    post.comments_count = int(n or 0)
    db.commit()
    db.refresh(post)
    author = db.get(User, post.author_id)
    return {"ok": True, "item": _post_out(post, author.username if author else "未知用户")}


@router.post("/{post_id}/like")
def like_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    existing = db.scalar(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    )
    if existing is None:
        db.add(PostLike(post_id=post_id, user_id=user.id))
        post.likes_count += 1
        if post.author_id != user.id:
            db.add(
                Notification(
                    user_id=post.author_id,
                    kind="post_like",
                    actor_id=user.id,
                    post_id=post.id,
                    comment_id=None,
                    post_title=(post.title or "")[:200],
                    snippet="赞了您的帖子",
                )
            )
        db.commit()
        db.refresh(post)
    return {"ok": True, "liked": True, "likes": post.likes_count}


@router.delete("/{post_id}/like")
def unlike_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    existing = db.scalar(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    )
    if existing is not None:
        db.delete(existing)
        if post.likes_count > 0:
            post.likes_count -= 1
        db.commit()
        db.refresh(post)
    return {"ok": True, "liked": False, "likes": post.likes_count}


@router.post("/{post_id}/comments")
def create_comment(
    post_id: int,
    payload: CreateCommentIn,
    user: User = Depends(get_current_user_writer),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    content = payload.content.strip()
    if len(content) < 1:
        raise HTTPException(status_code=400, detail="评论不能为空")
    comment = PostComment(post_id=post_id, user_id=user.id, content=content)
    db.add(comment)
    db.flush()
    post.comments_count += 1
    if post.author_id != user.id:
        preview = content[:240] + ("…" if len(content) > 240 else "")
        db.add(
            Notification(
                user_id=post.author_id,
                kind="post_comment",
                actor_id=user.id,
                post_id=post.id,
                comment_id=comment.id,
                post_title=(post.title or "")[:200],
                snippet=preview,
            )
        )
    db.commit()
    db.refresh(comment)
    db.refresh(post)
    return {
        "ok": True,
        "comment": _comment_out(comment, user.username, liked_by_me=False),
        "comments": post.comments_count,
    }


@router.delete("/{post_id}/comments/{comment_id}")
def soft_delete_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    comment = db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id or comment.deleted_at is not None:
        raise HTTPException(status_code=404, detail="评论不存在")
    if not _can_modify_comment(user, comment):
        raise HTTPException(status_code=403, detail="无权删除该评论")
    comment.deleted_at = _utcnow()
    comment.cascade_hide = False
    if post.comments_count > 0:
        post.comments_count -= 1
    db.commit()
    return {"ok": True, "comments": post.comments_count}


@router.post("/{post_id}/comments/{comment_id}/restore")
def restore_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    comment = db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.cascade_hide:
        raise HTTPException(status_code=400, detail="该评论随帖子删除，请先恢复帖子")
    if comment.deleted_at is None:
        raise HTTPException(status_code=400, detail="评论未处于删除状态")
    if not _can_modify_comment(user, comment):
        raise HTTPException(status_code=403, detail="无权恢复该评论")
    comment.deleted_at = None
    post.comments_count += 1
    db.commit()
    db.refresh(post)
    author = db.get(User, comment.user_id)
    return {
        "ok": True,
        "comment": _comment_out(comment, author.username if author else "未知用户", liked_by_me=False),
        "comments": post.comments_count,
    }


@router.post("/{post_id}/comments/{comment_id}/like")
def like_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    comment = db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id or comment.deleted_at is not None:
        raise HTTPException(status_code=404, detail="评论不存在")
    existing = db.scalar(
        select(CommentLike).where(
            CommentLike.comment_id == comment_id,
            CommentLike.user_id == user.id,
        )
    )
    if existing is None:
        db.add(CommentLike(comment_id=comment_id, user_id=user.id))
        comment.likes_count += 1
        db.commit()
        db.refresh(comment)
    return {"ok": True, "liked": True, "likes": comment.likes_count}


@router.delete("/{post_id}/comments/{comment_id}/like")
def unlike_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    comment = db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id or comment.deleted_at is not None:
        raise HTTPException(status_code=404, detail="评论不存在")
    existing = db.scalar(
        select(CommentLike).where(
            CommentLike.comment_id == comment_id,
            CommentLike.user_id == user.id,
        )
    )
    if existing is not None:
        db.delete(existing)
        if comment.likes_count > 0:
            comment.likes_count -= 1
        db.commit()
        db.refresh(comment)
    return {"ok": True, "liked": False, "likes": comment.likes_count}
