from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    account: str = Field(min_length=2, max_length=255, description="username or email")
    password: str = Field(min_length=6, max_length=128)


class PatchProfileIn(BaseModel):
    """更新头像：支持 https 图片链接或 data:image/*;base64,（本地上传经前端压缩）。"""

    model_config = ConfigDict(populate_by_name=True)
    avatar_url: str | None = Field(default=None, max_length=400_000, alias="avatarUrl")


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _public_user(u: User) -> dict:
    av = getattr(u, "avatar_url", None)
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "avatarUrl": (av.strip() if isinstance(av, str) and av.strip() else None),
        "isSuperuser": getattr(u, "is_superuser", False),
        "isSilenced": getattr(u, "is_silenced", False),
    }


def _normalize_username(username: str) -> str:
    return username.strip()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/register", response_model=AuthOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> AuthOut:
    username = _normalize_username(payload.username)
    email = _normalize_email(payload.email)
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    existing = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == username.lower(), func.lower(User.email) == email)
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="用户名或邮箱已存在")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), extra={"username": user.username})
    return AuthOut(access_token=token, user=_public_user(user))


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> AuthOut:
    account = payload.account.strip()
    if not account:
        raise HTTPException(status_code=400, detail="账号不能为空")

    user = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == account.lower(), func.lower(User.email) == account.lower())
        )
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    token = create_access_token(subject=str(user.id), extra={"username": user.username})
    return AuthOut(access_token=token, user=_public_user(user))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效") from exc

    sub = str(payload.get("sub") or "").strip()
    if not sub.isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效令牌")
    user = db.get(User, int(sub))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception:
        return None

    sub = str(payload.get("sub") or "").strip()
    if not sub.isdigit():
        return None
    return db.get(User, int(sub))


def get_current_user_writer(user: User = Depends(get_current_user)) -> User:
    if getattr(user, "is_silenced", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您已被禁言，暂时无法发帖与评论")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_superuser", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return {"ok": True, "user": _public_user(user)}


def _store_avatar_value(s: str) -> str:
    """校验并返回写入库的字符串。"""
    s = s.strip()
    if len(s) > 400_000:
        raise HTTPException(status_code=400, detail="头像数据过大，请选用较小的图片")
    if s.startswith("https://") or s.startswith("http://"):
        return s[:8192]
    data_prefixes = (
        "data:image/jpeg;base64,",
        "data:image/jpg;base64,",
        "data:image/png;base64,",
        "data:image/webp;base64,",
        "data:image/gif;base64,",
    )
    if any(s.startswith(p) for p in data_prefixes):
        return s
    raise HTTPException(
        status_code=400,
        detail="头像需为 https 图片链接，或使用本地上传的 JPG / PNG / WebP / GIF",
    )


@router.patch("/profile")
def patch_profile(
    payload: PatchProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.avatar_url is not None:
        s = payload.avatar_url.strip()
        if not s:
            user.avatar_url = None
        else:
            user.avatar_url = _store_avatar_value(s)
        db.commit()
        db.refresh(user)
    return {"ok": True, "user": _public_user(user)}


@router.post("/logout")
def logout(_: User = Depends(get_current_user)) -> dict:
    # 当前使用无状态 JWT；服务端无需持久化会话，仅返回成功供前端清理本地 token。
    return {"ok": True, "message": "已退出登录"}
