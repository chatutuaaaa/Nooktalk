from __future__ import annotations

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth_routes import get_current_user
from .db import get_db
from .models import ScheduleEvent, User

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _to_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _from_ms(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _event_out(ev: ScheduleEvent) -> dict:
    return {
        "id": ev.id,
        "title": ev.title,
        "note": ev.note or "",
        "startAt": _to_ms(ev.start_at),
    }


class ScheduleUpsertIn(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1, max_length=120)
    note: str = Field(default="", max_length=1000)
    startAt: int


@router.get("/events")
def list_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(
        select(ScheduleEvent)
        .where(ScheduleEvent.user_id == user.id)
        .order_by(ScheduleEvent.start_at.asc())
    ).all()
    return {"ok": True, "events": [_event_out(r) for r in rows]}


@router.post("/events")
def upsert_event(
    payload: ScheduleUpsertIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if payload.startAt <= 0:
        raise HTTPException(status_code=400, detail="startAt 无效")

    ev = None
    if payload.id:
        ev = db.scalar(
            select(ScheduleEvent).where(
                ScheduleEvent.id == payload.id, ScheduleEvent.user_id == user.id
            )
        )
    if ev is None:
        ev = ScheduleEvent(id=payload.id or str(uuid.uuid4()), user_id=user.id)
        db.add(ev)

    ev.title = title
    ev.note = payload.note.strip()
    ev.start_at = _from_ms(payload.startAt)
    db.commit()
    db.refresh(ev)
    return {"ok": True, "event": _event_out(ev)}


@router.delete("/events/{event_id}")
def delete_event(
    event_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    ev = db.scalar(
        select(ScheduleEvent).where(ScheduleEvent.id == event_id, ScheduleEvent.user_id == user.id)
    )
    if ev is None:
        raise HTTPException(status_code=404, detail="日程不存在")
    db.delete(ev)
    db.commit()
    return {"ok": True}
