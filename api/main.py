"""
天气 HTTP 接口，供 Nooktalk 前端调用；图标判定逻辑与 forum home 视图一致。
运行：在项目根目录执行
  set AMAP_KEY=你的key
  python -m uvicorn api.main:app --host 127.0.0.1 --port 5055
"""
from __future__ import annotations

import os
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .amap_weather import get_live_weather, resolve_adcode_for_client_ip

app = FastAPI(title="Nooktalk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    adcode = resolve_adcode_for_client_ip(_client_ip(request))
    live = get_live_weather(adcode)
    if not live:
        return {
            "ok": False,
            "error": "no_key_or_unavailable" if not os.environ.get("AMAP_KEY", "").strip() else "unavailable",
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
