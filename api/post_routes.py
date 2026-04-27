from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .auth_routes import get_current_user, get_optional_user
from .db import get_db
from .models import Post, PostComment, PostLike, User

router = APIRouter(prefix="/posts", tags=["posts"])


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
        "title": post.title,
        "author": author_name,
        "tag": post.tag,
        "topics": [s for s in (post.topics or "").split(",") if s],
        "excerpt": excerpt,
        "body": post.body,
        "pinned": post.pinned,
        "createdAt": _to_ms(post.created_at),
        "stats": {
            "views": post.views,
            "comments": post.comments_count,
            "likes": post.likes_count,
        },
    }


class CreatePostIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=5000)
    tag: str = Field(min_length=1, max_length=20)
    topics: list[str] = Field(default_factory=list)


class CreateCommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


def _comment_out(comment: PostComment, author_name: str) -> dict:
    return {
        "id": comment.id,
        "postId": comment.post_id,
        "author": author_name,
        "content": comment.content,
        "createdAt": _to_ms(comment.created_at),
    }


@router.get("")
def list_posts(
    tag: str = Query(default="全部"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    q = select(Post).order_by(desc(Post.pinned), desc(Post.created_at))
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
    author = db.get(User, post.author_id)

    if increment_view:
        post.views += 1
        db.commit()
        db.refresh(post)

    comments = db.scalars(
        select(PostComment).where(PostComment.post_id == post_id).order_by(PostComment.created_at.asc())
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
    return {
        "ok": True,
        "item": _post_out(post, author.username if author else "未知用户"),
        "likedByMe": liked_by_me,
        "comments": [_comment_out(c, comment_authors.get(c.user_id, "未知用户")) for c in comments],
    }


@router.post("")
def create_post(
    payload: CreatePostIn,
    user: User = Depends(get_current_user),
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


@router.post("/{post_id}/like")
def like_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    existing = db.scalar(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    )
    if existing is None:
        db.add(PostLike(post_id=post_id, user_id=user.id))
        post.likes_count += 1
        db.commit()
        db.refresh(post)
    return {"ok": True, "liked": True, "likes": post.likes_count}


@router.delete("/{post_id}/like")
def unlike_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    post = db.get(Post, post_id)
    if post is None:
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    content = payload.content.strip()
    if len(content) < 1:
        raise HTTPException(status_code=400, detail="评论不能为空")
    comment = PostComment(post_id=post_id, user_id=user.id, content=content)
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    db.refresh(post)
    return {
        "ok": True,
        "comment": _comment_out(comment, user.username),
        "comments": post.comments_count,
    }
