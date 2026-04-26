"""
本地 music 目录：列曲目并流式传输；music 为项目根目录下文件夹。
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

MUSIC_EXTS: frozenset[str] = frozenset(
    {".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wav", ".webm", ".mp4"}
)

router = APIRouter()


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def get_music_dir() -> Path:
    return _project_root() / "music"


def _is_safe_basename(name: str) -> bool:
    if not name or name.strip() != name:
        return False
    if os.path.sep in name or (os.path.altsep and os.path.altsep in name):
        return False
    if ".." in name or name in (".", ".."):
        return False
    return True


@router.get("/music/tracks")
def list_tracks() -> dict:
    d = get_music_dir()
    if not d.is_dir():
        return {"ok": True, "tracks": [], "error": "music_dir_missing"}
    out: list[dict] = []
    for p in sorted(d.iterdir(), key=lambda x: x.name.lower()):
        if p.is_file() and p.suffix.lower() in MUSIC_EXTS:
            out.append(
                {
                    "filename": p.name,
                    "title": p.stem,
                    "url": f"/api/music/stream/{_quote_segment(p.name)}",
                }
            )
    return {"ok": True, "tracks": out, "error": None}


def _quote_segment(s: str) -> str:
    return quote(s, safe="")


@router.get("/music/stream/{filename:path}")
def stream_track(filename: str) -> FileResponse:
    if not _is_safe_basename(filename):
        raise HTTPException(status_code=400, detail="invalid filename")
    base = get_music_dir().resolve()
    target = (base / filename).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=404, detail="not found")
    if not target.is_file() or target.suffix.lower() not in MUSIC_EXTS:
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(
        path=target,
        media_type=None,
        filename=target.name,
    )
