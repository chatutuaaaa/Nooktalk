"""
天气 HTTP 接口，供 Nooktalk 前端调用；图标判定逻辑与 forum home 视图一致。
运行：在项目根目录执行
  python -m uvicorn api.main:app --host 127.0.0.1 --port 5055
（AMAP_KEY 从项目根 .env 读取，见 .env.example）
"""
from __future__ import annotations

import os
import threading
import time
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .bootstrap_schema import bootstrap_promote_superuser, ensure_community_columns
from .music_routes import router as music_router
from .auth_routes import router as auth_router
from .schedule_routes import router as schedule_router
from .post_routes import router as post_router
from .admin_routes import router as admin_router
from .notification_routes import router as notification_router
from .purge_job import run_purge_once
from .db import engine
from .models import Base
from .amap_weather import (
    get_forecast_casts,
    get_live_weather,
    load_project_env,
    resolve_adcode_for_client_ip,
    _amap_key,
)

load_project_env()

app = FastAPI(title="Nooktalk API")
app.include_router(music_router, prefix="/api", tags=["music"])
app.include_router(auth_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(post_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(notification_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _purge_loop() -> None:
    """每小时尝试一次物理清理（ISSUE §5）。"""
    while True:
        try:
            run_purge_once()
        except Exception:
            pass
        time.sleep(3600)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_community_columns(engine)
    bootstrap_promote_superuser(
        engine, (os.environ.get("BOOTSTRAP_ADMIN_USERNAME") or "").strip()
    )
    threading.Thread(target=_purge_loop, name="purge-soft-delete", daemon=True).start()


def _client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or None
    if request.client:
        return request.client.host
    return None


def pick_weather_icon(weather: str, reporttime: str) -> str:
    """与 forum core.views.home 中逻辑一致，返回 /weather/xxx.svg 路径。"""
    desc = (weather or "").strip()
    hour = None
    try:
        dt = datetime.strptime(reporttime, "%Y-%m-%d %H:%M:%S")
        hour = dt.hour
    except Exception:
        pass
    is_night = hour is not None and (hour >= 18 or hour < 6)

    def pick(icon: str) -> str:
        return f"/weather/{icon}"

    if any(k in desc for k in ["雷", "雷阵雨", "雷暴"]):
        return pick("thunderstorm.svg")
    if any(k in desc for k in ["暴雨", "大雨", "特大暴雨"]):
        return pick("heavy-rain.svg")
    if "雨" in desc:
        return pick("light-rain.svg")
    if any(k in desc for k in ["雪", "雨夹雪"]):
        return pick("snow.svg")
    if any(k in desc for k in ["沙", "尘", "沙尘暴"]):
        return pick("sandstorm.svg")
    if any(k in desc for k in ["雾", "霾"]):
        return pick("fog.svg")
    if any(k in desc for k in ["大风", "狂风"]):
        return pick("heavy-wind.svg")
    if "风" in desc:
        return pick("wind.svg")
    if any(k in desc for k in ["多云", "阴"]):
        return pick("cloudy-night.svg" if is_night else "cloudy.svg")
    if "晴" in desc:
        return pick("moon.svg" if is_night else "sunny.svg")
    return pick("cloudy.svg")


def format_weather_date(reporttime: str) -> str:
    try:
        dt = datetime.strptime(reporttime, "%Y-%m-%d %H:%M:%S")
        week_map = ["一", "二", "三", "四", "五", "六", "日"]
        return f"{dt.strftime('%Y年%m月%d日')} 周{week_map[dt.weekday()]}"
    except Exception:
        return reporttime


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/weather")
def weather(request: Request) -> dict:
    load_project_env()
    adcode = resolve_adcode_for_client_ip(_client_ip(request))
    live, err = get_live_weather(adcode)
    if not live:
        if err == "no_key" or not _amap_key():
            err_out = "no_key"
        else:
            err_out = "unavailable"
        return {
            "ok": False,
            "error": err_out,
            "amapInfo": err if err and err != "no_key" else None,
            "live": None,
            "weatherLocation": None,
            "weatherDate": None,
            "weatherIcon": "/weather/cloudy.svg",
        }
    loc = " ".join([p for p in [live.province, live.city] if p]).strip() or None
    icon = pick_weather_icon(live.weather, live.reporttime)
    wdate = format_weather_date(live.reporttime)
    return {
        "ok": True,
        "live": {
            "province": live.province,
            "city": live.city,
            "adcode": live.adcode,
            "weather": live.weather,
            "temperatureC": live.temperature_c,
            "winddirection": live.winddirection,
            "windpower": live.windpower,
            "humidity": live.humidity,
            "reporttime": live.reporttime,
        },
        "weatherLocation": loc,
        "weatherDate": wdate,
        "weatherIcon": icon,
    }


@app.get("/api/weather/forecast")
def weather_forecast(request: Request) -> dict:
    """未来数日预报（高德 casts，多为 4 日）；与实况同一套 IP→adcode。"""
    load_project_env()
    adcode = resolve_adcode_for_client_ip(_client_ip(request))
    days_raw, err, head = get_forecast_casts(adcode)
    if not days_raw:
        if err == "no_key" or not _amap_key():
            err_out = "no_key"
        else:
            err_out = "unavailable"
        return {
            "ok": False,
            "error": err_out,
            "amapInfo": err if err and err != "no_key" else None,
            "location": None,
            "adcode": adcode,
            "days": [],
        }
    loc = None
    if head:
        loc = " ".join(
            [p for p in [head.get("province", ""), head.get("city", "")] if p]
        ).strip() or None
    days_out: list[dict] = []
    for d in days_raw:
        day_w = d.get("dayweather") or ""
        date_s = d.get("date") or "2000-01-01"
        icon = pick_weather_icon(day_w, f"{date_s} 12:00:00")
        days_out.append(
            {
                **d,
                "weatherIcon": icon,
            }
        )
    return {
        "ok": True,
        "error": None,
        "amapInfo": None,
        "location": loc,
        "adcode": adcode,
        "days": days_out,
        "note": "高德 Web 服务预报为多日滚动（常见为 4 日），以接口返回条数为准。",
    }
