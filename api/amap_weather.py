"""
逻辑与 E:\\python\\forum\\core\\services\\amap_weather.py 一致：高德 IP 定位 + 实时天气，内存 TTL 缓存。
环境变量：AMAP_KEY（必填才返回天气），AMAP_DEFAULT_ADCODE（默认 110000）。
"""
from __future__ import annotations

import json
import os
import socket
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# 从项目根目录 .env 加载（勿提交到 Git）
try:
    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parent.parent
    load_dotenv(_root / ".env", override=False)
except ImportError:
    pass

AMAP_KEY = os.environ.get("AMAP_KEY", "").strip()
AMAP_DEFAULT_ADCODE = os.environ.get("AMAP_DEFAULT_ADCODE", "110000").strip() or "110000"

_mem_cache: dict[str, tuple[float, object]] = {}


def _cache_get(key: str) -> object | None:
    hit = _mem_cache.get(key)
    if not hit:
        return None
    exp, val = hit
    if time.time() > exp:
        del _mem_cache[key]
        return None
    return val


def _cache_set(key: str, value: object, ttl_s: float) -> None:
    _mem_cache[key] = (time.time() + ttl_s, value)


@dataclass(frozen=True)
class AmapLiveWeather:
    province: str
    city: str
    adcode: str
    weather: str
    temperature_c: str
    winddirection: str
    windpower: str
    humidity: str
    reporttime: str


def _http_get_json(url: str, timeout_s: float = 3.5) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "Nooktalk-weather/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        data = resp.read().decode("utf-8")
    return json.loads(data)


def _is_public_ip(ip: str) -> bool:
    try:
        packed = socket.inet_aton(ip)
    except OSError:
        return False
    first = packed[0]
    second = packed[1]
    if first == 10:
        return False
    if first == 172 and 16 <= second <= 31:
        return False
    if first == 192 and second == 168:
        return False
    if first == 127:
        return False
    return True


def resolve_adcode_for_client_ip(client_ip: str | None) -> str:
    if not AMAP_KEY or not client_ip or not _is_public_ip(client_ip):
        return AMAP_DEFAULT_ADCODE
    key = f"amap:ip_adcode:{client_ip}"
    cached = _cache_get(key)
    if isinstance(cached, str):
        return cached
    url = "https://restapi.amap.com/v3/ip?" + urllib.parse.urlencode(
        {"ip": client_ip, "key": AMAP_KEY}
    )
    try:
        payload = _http_get_json(url)
    except Exception:
        return AMAP_DEFAULT_ADCODE
    adcode = str(payload.get("adcode") or "").strip()
    if adcode:
        _cache_set(key, adcode, 60 * 60)
        return adcode
    return AMAP_DEFAULT_ADCODE


def get_live_weather(adcode: str) -> AmapLiveWeather | None:
    if not AMAP_KEY:
        return None
    key = f"amap:live_weather:{adcode}"
    cached = _cache_get(key)
    if isinstance(cached, AmapLiveWeather):
        return cached
    url = "https://restapi.amap.com/v3/weather/weatherInfo?" + urllib.parse.urlencode(
        {"city": adcode, "key": AMAP_KEY}
    )
    try:
        payload = _http_get_json(url)
    except Exception:
        return None
    if str(payload.get("status")) != "1":
        return None
    lives = payload.get("lives") or []
    if not lives:
        return None
    live = lives[0]
    model = AmapLiveWeather(
        province=str(live.get("province") or ""),
        city=str(live.get("city") or ""),
        adcode=str(live.get("adcode") or adcode),
        weather=str(live.get("weather") or ""),
        temperature_c=str(live.get("temperature") or ""),
        winddirection=str(live.get("winddirection") or ""),
        windpower=str(live.get("windpower") or ""),
        humidity=str(live.get("humidity") or ""),
        reporttime=str(live.get("reporttime") or ""),
    )
    _cache_set(key, model, 60 * 10)
    return model
