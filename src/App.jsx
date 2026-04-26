import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Link2,
  ListOrdered,
  MapPin,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { getLunarDayLabel, getLunarMonthTitle } from "./lunarUtil";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { MusicPlayer } from "./MusicPlayer";
import { useMusicPlayback } from "./useMusicPlayback.js";
import { TimeTools } from "./TimeTools";
import { WeatherWeek } from "./WeatherWeek";
import "./App.css";

const NAV = [
  { id: "home", label: "探索", icon: Sparkles },
  { id: "schedule", label: "日程日历", icon: CalendarDays },
  { id: "recent", label: "最新讨论", icon: ListOrdered },
  { id: "about", label: "关于隅言", icon: BookOpen },
  { id: "share", label: "推荐分享", icon: Link2 },
  { id: "columns", label: "精品专栏", icon: FileText },
];

const POLAROIDS = [
  { bg: "linear-gradient(145deg, #c8f0d8, #e8faf0)" },
  { bg: "linear-gradient(145deg, #f8e0c8, #fff5ea)" },
  { bg: "linear-gradient(145deg, #d8e4ff, #f0f4ff)" },
  { bg: "linear-gradient(145deg, #e8d8f8, #f5f0ff)" },
];

/** 与 Vite `base` 一致，供 History API 与后退/前进同步 */
function homePathname() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
}

function schedulePathname() {
  return new URL("schedule", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function weatherPathname() {
  return new URL("weather", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function timePathname() {
  return new URL("time", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function musicPathname() {
  return new URL("music", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function viewFromPathname() {
  const p = window.location.pathname;
  if (p === schedulePathname()) return "schedule";
  if (p === weatherPathname()) return "weather";
  if (p === timePathname()) return "time";
  if (p === musicPathname()) return "music";
  return "home";
}

function useNow() {
  const [d, setD] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setD(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return d;
}

function getGreeting(hour) {
  if (hour < 5) return { label: "夜深了" };
  if (hour < 11) return { label: "早上好" };
  if (hour < 14) return { label: "中午好" };
  if (hour < 18) return { label: "下午好" };
  if (hour < 23) return { label: "晚上好" };
  return { label: "晚安" };
}

function buildCalendar(d) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const lead = startWeekday;
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push({ type: "pad" });
  for (let day = 1; day <= lastDate; day += 1) {
    const isToday =
      d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    const lunarDay = getLunarDayLabel(year, month, day);
    cells.push({ type: "day", day, isToday, lunarDay });
  }
  const tail = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < tail; i += 1) cells.push({ type: "pad" });
  return { year, month, cells, monthLabel: month + 1 };
}

function WeatherWidget({ onOpenForecast }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/weather");
        const data = await res.json();
        if (!cancelled) {
          setPayload(data);
        }
      } catch {
        if (!cancelled) {
          setPayload({ ok: false });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="card weather-card">
        <p className="weather-unavailable">天气加载中…</p>
      </div>
    );
  }

  if (!payload?.ok || !payload.live) {
    return (
      <div className="card weather-card">
        <p className="weather-unavailable">天气数据暂不可用</p>
        <p className="weather-hint">
          {payload.error === "no_key"
            ? "未从项目根 .env 读到 AMAP_KEY；保存 .env 后请重启后端的 uvicorn 进程再试（UTF-8 建议无 BOM，可用一行：AMAP_KEY=你的key）。"
            : "请确认本机已运行 `python -m uvicorn api.main:app --port 5055`、并在高德控制台为该 Key 开通「Web 服务」。"}
        </p>
        {payload.amapInfo ? (
          <p className="weather-hint" title="高德 API 说明">
            接口返回：{String(payload.amapInfo)}
          </p>
        ) : null}
      </div>
    );
  }

  const w = payload.live;
  const loc = payload.weatherLocation || w.city;
  const wdate = payload.weatherDate || w.reporttime;
  return (
    <button
      type="button"
      className="card weather-card weather-card--go"
      onClick={onOpenForecast}
      aria-label="打开未来天气，查看逐日预报"
    >
      <div className="weather-widget">
        <div className="weather-top">
          <div className="weather-title">
            <span className="weather-icon" aria-hidden>
              <img src={payload.weatherIcon} alt="" width={18} height={18} />
            </span>
            <span>天气</span>
          </div>
        </div>
        <div className="weather-sub">
          <MapPin className="weather-pin-icon" size={14} strokeWidth={2.2} aria-hidden />
          <span className="weather-loc">{loc}</span>
          <span className="weather-time">{wdate}</span>
        </div>
        <div className="weather-main">
          <div className="weather-temp">
            <span className="weather-temp-value">{w.temperatureC}</span>
            <span className="weather-temp-unit">°C</span>
          </div>
          <div className="weather-right">
            <div className="weather-desc">{w.weather}</div>
            <div className="weather-kv">
              <span className="weather-k">体感</span>
              <span className="weather-v">{w.temperatureC}°C</span>
            </div>
            <div className="weather-kv">
              <span className="weather-k">湿度</span>
              <span className="weather-v">{w.humidity}%</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function App() {
  const {
    hasTracks,
    cur,
    listLoading: musicListLoading,
    listError: musicListError,
    playing: musicPlaying,
    currentTime: musicTime,
    duration: musicDuration,
    progress: musicProgress,
    formatTime: formatMusicTime,
    togglePlay: musicToggle,
    goPrev: musicPrev,
    goNext: musicNext,
    seekFromBarEvent: musicSeekFromBar,
    nudgeBySeconds: musicNudge,
  } = useMusicPlayback();
  const [activePage, setActivePage] = useState(() =>
    typeof window !== "undefined" ? viewFromPathname() : "home",
  );

  const goToPage = useCallback((page) => {
    if (page === "home") {
      if (activePage === "home") return;
      history.pushState({ view: "home" }, "", homePathname());
      setActivePage("home");
      return;
    }
    if (page === "schedule") {
      if (activePage === "schedule") return;
      history.pushState({ view: "schedule" }, "", schedulePathname());
      setActivePage("schedule");
      return;
    }
    if (page === "weather") {
      if (activePage === "weather") return;
      history.pushState({ view: "weather" }, "", weatherPathname());
      setActivePage("weather");
      return;
    }
    if (page === "time") {
      if (activePage === "time") return;
      history.pushState({ view: "time" }, "", timePathname());
      setActivePage("time");
      return;
    }
    if (page === "music") {
      if (activePage === "music") return;
      history.pushState({ view: "music" }, "", musicPathname());
      setActivePage("music");
    }
  }, [activePage]);

  useEffect(() => {
    const onPop = () => {
      setActivePage(viewFromPathname());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const now = useNow();
  const { label: greetLabel } = getGreeting(now.getHours());
  const timeText = useMemo(
    () =>
      now.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [now],
  );
  const { year, month, cells, monthLabel } = useMemo(
    () => buildCalendar(now),
    [now],
  );
  const lunarMonthTitle = useMemo(
    () => getLunarMonthTitle(year, month),
    [year, month],
  );
  const weekday = now.toLocaleDateString("zh-CN", { weekday: "long" });

  const onMusicCardSurfaceClick = (e) => {
    if (e.target.closest("button, .music-card-progress, .music-card-time")) {
      return;
    }
    goToPage("music");
  };

  const homeMusicTitle = musicListLoading
    ? "正在加载曲库…"
    : musicListError
      ? "曲库暂不可用"
      : !hasTracks
        ? "未检测到本地曲目"
        : (cur?.title ?? "—");
  const homeMusicFilename = hasTracks && cur?.filename ? cur.filename : null;
  const canShowMusicProgress =
    hasTracks && Number.isFinite(musicDuration) && musicDuration > 0;

  return (
    <div className="bento" lang="zh-CN">
      <aside className="col-left">
        <div className="card profile-card">
          <div className="profile-top">
            <div className="avatar" aria-hidden>
              🐱
            </div>
            <div className="brand-line">
              <div className="brand-zh">隅言</div>
              <div className="brand-en">Nooktalk</div>
            </div>
          </div>
          <p className="nav-label">GENERAL</p>
          <ul className="nav-list" role="navigation" aria-label="主菜单">
            {NAV.map((item) => {
              const Icon = item.icon;
              const href =
                item.id === "home"
                  ? homePathname() || "/"
                  : item.id === "schedule"
                    ? schedulePathname()
                    : "#";
              return (
                <li key={item.id}>
                  <a
                    className={
                      "nav-item" + (item.id === activePage ? " active" : "")
                    }
                    href={href}
                    onClick={(e) => {
                      if (item.id === "home" || item.id === "schedule") {
                        e.preventDefault();
                        goToPage(item.id);
                      } else {
                        e.preventDefault();
                      }
                    }}
                    aria-current={item.id === activePage ? "page" : undefined}
                  >
                    <Icon size={18} />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <WeatherWidget onOpenForecast={() => goToPage("weather")} />
      </aside>

      {activePage === "schedule" ? (
        <div className="col-center col-center--fill col-center--weather col-center--schedule">
          <ScheduleCalendar />
        </div>
      ) : activePage === "weather" ? (
        <div className="col-center col-center--fill col-center--weather">
          <WeatherWeek />
        </div>
      ) : activePage === "time" ? (
        <div className="col-center col-center--fill col-center--weather col-center--time">
          <TimeTools />
        </div>
      ) : activePage === "music" ? (
        <div className="col-center col-center--fill col-center--weather col-center--music">
          <MusicPlayer />
        </div>
      ) : (
        <>
          <div className="col-center">
            <div className="card polaroid-row">
              <div className="polaroid-inner" aria-label="欢迎拼贴图">
                {POLAROIDS.map((p, i) => (
                  <div key={i} className="polaroid">
                    <div
                      className="polaroid-blob"
                      style={{ background: p.bg }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card greeting-block">
              <div className="greeting-avatar" aria-hidden>
                🪴
              </div>
              <p className="greeting-time">
                {greetLabel} · {weekday}
              </p>
              <p className="greeting-line">
                我是 <strong>隅友</strong>，很高兴在 Nooktalk 遇见你。
              </p>
              <div className="social-row" aria-label="外站官方链接">
                <a
                  className="social-pill bg-github"
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="icon-wrap">
                    <span style={{ fontSize: 11, fontWeight: 800 }}>G</span>
                  </span>
                  GitHub
                </a>
                <a
                  className="social-pill bg-bili"
                  href="https://www.bilibili.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="icon-wrap">
                    <span style={{ fontSize: 10, fontWeight: 800 }}>b</span>
                  </span>
                  哔哩哔哩
                </a>
                <a
                  className="social-pill bg-xhs"
                  href="https://www.xiaohongshu.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="icon-wrap">
                    <span style={{ fontSize: 9, fontWeight: 800 }}>红</span>
                  </span>
                  小红书
                </a>
                <a
                  className="social-pill bg-mail"
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="icon-wrap">
                    <span style={{ fontSize: 10, fontWeight: 800 }}>M</span>
                  </span>
                  Gmail
                </a>
              </div>
            </div>

            <div className="card picks-card">
              <div className="picks-icon" aria-hidden>
                ✨
              </div>
              <div className="picks-text">
                <strong>今日小推荐</strong>
                <span>
                  在论坛里，把长帖拆成「章节回复」，读感会更像一篇温柔的连载。
                </span>
              </div>
            </div>
          </div>

          <aside className="col-right">
            <button
              type="button"
              className="card clock-card clock-card--go"
              onClick={() => goToPage("time")}
              aria-label="打开时间工具：秒表、倒计时与当前时间"
            >
              <div className="digital-time" aria-live="polite">
                {timeText}
              </div>
            </button>

            <button
              type="button"
              className="card calendar-card calendar-card--go"
              onClick={() => goToPage("schedule")}
              aria-label="打开日程与日历，管理月历与待办"
            >
              <div className="cal-head">
                <div className="cal-head-titles">
                  <span className="cal-greg">
                    {year} 年 {monthLabel} 月
                  </span>
                  {lunarMonthTitle ? (
                    <span
                      className="cal-lunar-hint"
                      title="以月中为参考的农历年、月"
                    >
                      {lunarMonthTitle}
                    </span>
                  ) : null}
                </div>
                <Clock3 size={16} color="#6b7f74" className="cal-head-icon" />
              </div>
              <div className="cal-week" aria-hidden>
                {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div
                className="cal-grid"
                role="grid"
                aria-label="月历，点击整卡可进入完整日程"
              >
                {cells.map((c, i) => {
                  if (c.type === "pad")
                    return <div key={`p-${i}`} className="cal-day muted" />;
                  return (
                    <div
                      key={c.day}
                      className={"cal-day" + (c.isToday ? " today" : "")}
                      role="gridcell"
                    >
                      <span className="cal-solar">{c.day}</span>
                      {c.lunarDay ? (
                        <span className="cal-lunar-d">{c.lunarDay}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </button>

            <div
              className="card music-card music-card--go"
              onClick={onMusicCardSurfaceClick}
            >
              <div
                className="music-card-titles"
                title={
                  [homeMusicTitle, homeMusicFilename].filter(Boolean).join(" · ") || undefined
                }
              >
                <p className="track-name track-name--full">{homeMusicTitle}</p>
                {homeMusicFilename ? (
                  <p className="track-filename" aria-label={`文件名：${homeMusicFilename}`}>
                    {homeMusicFilename}
                  </p>
                ) : null}
              </div>
              <div
                className="music-controls"
                role="group"
                aria-label="播放控制"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="music-ctrl-btn"
                  aria-label="上一曲"
                  disabled={!hasTracks}
                  onClick={musicPrev}
                >
                  <SkipBack size={18} strokeWidth={2.2} className="music-ctrl-icon" />
                </button>
                <button
                  type="button"
                  className="music-ctrl-btn music-ctrl-btn--main"
                  onClick={musicToggle}
                  aria-label={musicPlaying ? "暂停" : "播放"}
                  aria-pressed={musicPlaying}
                  disabled={!hasTracks}
                >
                  {musicPlaying ? (
                    <Pause size={20} strokeWidth={2.4} fill="currentColor" className="music-ctrl-icon" />
                  ) : (
                    <Play size={20} strokeWidth={2.2} fill="currentColor" className="music-ctrl-icon" />
                  )}
                </button>
                <button
                  type="button"
                  className="music-ctrl-btn"
                  aria-label="下一曲"
                  disabled={!hasTracks}
                  onClick={musicNext}
                >
                  <SkipForward size={18} strokeWidth={2.2} className="music-ctrl-icon" />
                </button>
              </div>
              <div
                className={
                  "progress music-card-progress" + (canShowMusicProgress ? "" : " is-disabled")
                }
                role="slider"
                tabIndex={canShowMusicProgress ? 0 : -1}
                aria-label="播放进度"
                aria-valuemin={0}
                aria-valuemax={Math.round(musicDuration) || 0}
                aria-valuenow={Math.floor(musicTime)}
                aria-disabled={!canShowMusicProgress}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.currentTarget) musicSeekFromBar(e, e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.stopPropagation();
                  e.preventDefault();
                  musicNudge(e.key === "ArrowLeft" ? -5 : 5);
                }}
              >
                <div
                  className="progress-inner"
                  style={{ width: `${(canShowMusicProgress ? musicProgress : 0) * 100}%` }}
                />
              </div>
              <div className="music-card-time" aria-label="已播放与总时长">
                <span>{formatMusicTime(musicTime)}</span>
                <span>{formatMusicTime(musicDuration)}</span>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
