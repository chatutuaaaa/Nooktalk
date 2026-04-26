"""
高德 IP 定位 + 实时天气，内存 TTL 缓存。
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

# 项目根 = api 的上一级；另尝试 cwd 下的 .env（部分启动方式下 cwd 才是含 .env 的目录）
_root = Path(__file__).resolve().parent.parent


def load_project_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for base in (_root, Path.cwd().resolve()):
        p = (base / ".env").resolve()
        if p.is_file():
            load_dotenv(p, override=True, encoding="utf-8-sig")
            return


load_project_env()


def _amap_key() -> str:
    v = os.environ.get("AMAP_KEY", "").strip()
    if v:
        return v
    load_project_env()
    return os.environ.get("AMAP_KEY", "").strip()


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
    if not _amap_key() or not client_ip or not _is_public_ip(client_ip):
        return AMAP_DEFAULT_ADCODE
    key = f"amap:ip_adcode:{client_ip}"
    cached = _cache_get(key)
    if isinstance(cached, str):
        return cached
    url = "https://restapi.amap.com/v3/ip?" + urllib.parse.urlencode(
        {"ip": client_ip, "key": _amap_key()}
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


def get_live_weather(adcode: str) -> tuple[AmapLiveWeather | None, str | None]:
    """
    返回 (天气或 None, 错误说明或 None)。
    失败时 err 可能为: no_key / request_failed / 高德 info 等，便于定位。
    """
    if not _amap_key():
        return None, "no_key"
    key = f"amap:live_weather:{adcode}"
    cached = _cache_get(key)
    if isinstance(cached, AmapLiveWeather):
        return cached, None
    # 必须带 extensions=base 才返回 lives（实况）；all 只返回 forecasts，lives 为空
    url = "https://restapi.amap.com/v3/weather/weatherInfo?" + urllib.parse.urlencode(
        {"city": adcode, "key": _amap_key(), "extensions": "base"}
    )
    try:
        payload = _http_get_json(url)
    except Exception as e:
        return None, f"request_failed:{type(e).__name__}"
    if str(payload.get("status")) != "1":
        info = str(payload.get("info") or payload.get("infocode") or "").strip() or "amap_rejected"
        return None, info
    lives = payload.get("lives") or []
    if not lives:
        return None, "amap_no_lives"
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
    return model, None


def get_forecast_casts(
    adcode: str,
) -> tuple[list[dict[str, str]] | None, str | None, dict[str, str] | None]:
    """
    预报天气（extensions=all），返回 (casts 列表, 错误码, 城市头信息)。
    高德此接口一般返回 4 日。第三项为 province/city 等，供展示地点。
    """
    if not _amap_key():
        return None, "no_key", None
    key = f"amap:forecast:{adcode}"
    cached = _cache_get(key)
    if isinstance(cached, dict) and "days" in cached:
        d = cached.get("head")
        h = d if isinstance(d, dict) else None
        days = cached.get("days")
        if isinstance(days, list):
            return days, None, h
    if isinstance(cached, list):
        # 旧版仅缓存了 list
        return cached, None, None
    url = "https://restapi.amap.com/v3/weather/weatherInfo?" + urllib.parse.urlencode(
        {"city": adcode, "key": _amap_key(), "extensions": "all"}
    )
    try:
        payload = _http_get_json(url, timeout_s=4.0)
    except Exception as e:
        return None, f"request_failed:{type(e).__name__}", None
    if str(payload.get("status")) != "1":
        info = str(payload.get("info") or payload.get("infocode") or "").strip() or "amap_rejected"
        return None, info, None
    fcs = payload.get("forecasts") or []
    if not fcs or not isinstance(fcs[0], dict):
        return None, "amap_no_forecasts", None
    head0 = fcs[0]
    head = {
        "province": str(head0.get("province") or "").strip(),
        "city": str(head0.get("city") or "").strip(),
    }
    casts = head0.get("casts") or []
    if not casts:
        return None, "amap_no_casts", head
    out: list[dict[str, str]] = []
    for c in casts:
        if not isinstance(c, dict):
            continue
        out.append(
            {
                "date": str(c.get("date") or "").strip(),
                "week": str(c.get("week") or "").strip(),
                "dayweather": str(c.get("dayweather") or "").strip(),
                "nightweather": str(c.get("nightweather") or "").strip(),
                "daytemp": str(c.get("daytemp") or "").strip(),
                "nighttemp": str(c.get("nighttemp") or "").strip(),
                "daywind": str(c.get("daywind") or "").strip(),
                "nightwind": str(c.get("nightwind") or "").strip(),
                "daypower": str(c.get("daypower") or "").strip(),
                "nightpower": str(c.get("nightpower") or "").strip(),
            }
        )
    if not out:
        return None, "amap_no_casts", head
    _cache_set(key, {"days": out, "head": head}, 60 * 20)
    return out, None, head
