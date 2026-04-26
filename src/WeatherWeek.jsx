import { useEffect, useState } from "react";
import { MapPin, SunMedium } from "lucide-react";
import "./WeatherWeek.css";

export function WeatherWeek() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/weather/forecast");
        const data = await res.json();
        if (!cancelled) setPayload(data);
      } catch {
        if (!cancelled) setPayload({ ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="ww-page ww-page--fill" lang="zh-CN">
        <div className="card ww-hero">
          <h1 className="ww-hero-zh">未来天气</h1>
          <p className="ww-hero-hint">加载中…</p>
        </div>
      </div>
    );
  }

  if (!payload?.ok) {
    return (
      <div className="ww-page ww-page--fill" lang="zh-CN">
        <div className="card ww-hero">
          <h1 className="ww-hero-zh">未来天气</h1>
          <p className="ww-unavailable">
            {payload?.error === "no_key"
              ? "未读取到 AMAP_KEY 或接口不可用。请检查 .env 与天气服务是否已运行。"
              : "预报暂不可用。请确认后端已运行，且高德 Key 已开通 Web 服务。"}
          </p>
          {payload?.amapInfo ? (
            <p className="ww-hint">接口说明：{String(payload.amapInfo)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const { days = [], location, note } = payload;
  const list = days.slice(0, 4);

  return (
    <div className="ww-page ww-page--fill" lang="zh-CN">
      <div className="card ww-hero">
        <div className="ww-hero-top">
          <span className="ww-hero-icon" aria-hidden>
            <SunMedium size={24} strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="ww-hero-zh">未来天气</h1>
            <p className="ww-hero-sub">未来四日逐日预报：昼夜现象、温度区间与风况（数据来自高德）</p>
          </div>
        </div>
        {location ? (
          <p className="ww-loc">
            <MapPin size={16} className="ww-pin" strokeWidth={2.2} aria-hidden />
            {location}
          </p>
        ) : null}
        {note ? <p className="ww-hint">{note}</p> : null}
      </div>

      <div className="ww-grid" role="list" aria-label="四日天气">
        {list.map((d) => (
          <article key={d.date} className="card ww-day" role="listitem">
            <div className="ww-day-top">
              <time className="ww-date" dateTime={d.date}>
                {d.date}
              </time>
              <span className="ww-weekday">{d.week || "—"}</span>
            </div>
            <div className="ww-day-icon-wrap" aria-hidden>
              <img src={d.weatherIcon} alt="" width={56} height={56} className="ww-day-icon" />
            </div>
            <div className="ww-block">
              <p className="ww-block-label">白天</p>
              <p className="ww-day-weather">{d.dayweather || "—"}</p>
              <p className="ww-templine">
                <span className="ww-temp high">{d.daytemp}</span>
                <span className="ww-temp-unit">°C</span>
              </p>
            </div>
            <div className="ww-block ww-block--night">
              <p className="ww-block-label">夜间</p>
              <p className="ww-night-weather">{d.nightweather || "—"}</p>
              <p className="ww-templine">
                <span className="ww-temp low">{d.nighttemp}</span>
                <span className="ww-temp-unit">°C</span>
              </p>
            </div>
            <div className="ww-wind-block">
              <p className="ww-wind-line">
                <span className="ww-wind-k">昼风</span>
                <span className="ww-wind-v">
                  {d.daywind} · {d.daypower}
                </span>
              </p>
              <p className="ww-wind-line">
                <span className="ww-wind-k">夜风</span>
                <span className="ww-wind-v">
                  {d.nightwind} · {d.nightpower}
                </span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
