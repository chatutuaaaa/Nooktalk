import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  FileText,
  Link2,
  ListOrdered,
  MapPin,
  Play,
  Sparkles,
} from "lucide-react";
import { formatLunarParts, toLunar } from "lunar";
import "./App.css";

const LUNAR_TZ = { timezone: "Asia/Shanghai" };

const NAV = [
  { id: "recent", label: "最新讨论", icon: ListOrdered, active: false },
  { id: "explore", label: "探索", icon: Sparkles, active: true },
  { id: "about", label: "关于隅言", icon: BookOpen, active: false },
  { id: "share", label: "推荐分享", icon: Link2, active: false },
  { id: "columns", label: "精品专栏", icon: FileText, active: false },
];

const POLAROIDS = [
  { bg: "linear-gradient(145deg, #c8f0d8, #e8faf0)" },
  { bg: "linear-gradient(145deg, #f8e0c8, #fff5ea)" },
  { bg: "linear-gradient(145deg, #d8e4ff, #f0f4ff)" },
  { bg: "linear-gradient(145deg, #e8d8f8, #f5f0ff)" },
];

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

/** 该公历日对应的农历日文案，如「初一」「廿三」 */
function getLunarDayLabel(gregorianYear, monthIndex0, day) {
  try {
    const { lunar } = toLunar(
      { year: gregorianYear, month: monthIndex0 + 1, day },
      LUNAR_TZ,
    );
    const parts = formatLunarParts(lunar, { prefix: false, stemBranch: false });
    const d = parts.find((p) => p.type === "day");
    return d?.value ?? "";
  } catch {
    return "";
  }
}

/** 标题副行：以月中为参考的农历年、月（公历月跨多农历月时作示意） */
function getLunarMonthTitle(gregorianYear, monthIndex0) {
  try {
    const { lunar } = toLunar(
      { year: gregorianYear, month: monthIndex0 + 1, day: 15 },
      LUNAR_TZ,
    );
    const parts = formatLunarParts(lunar, { prefix: "农历" });
    return parts
      .filter((p) => p.type !== "day")
      .map((p) => p.value)
      .join("");
  } catch {
    return "";
  }
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

function WeatherWidget() {
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
        <p className="weather-hint">配置高德 AMAP_KEY 并运行天气接口后可显示实时数据。</p>
      </div>
    );
  }

  const w = payload.live;
  const loc = payload.weatherLocation || w.city;
  const wdate = payload.weatherDate || w.reporttime;
  return (
    <div className="card weather-card">
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
    </div>
  );
}

function App() {
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
              return (
                <li key={item.id}>
                  <a
                    className={"nav-item" + (item.active ? " active" : "")}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Icon size={18} />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <WeatherWidget />
      </aside>

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
            <span>在论坛里，把长帖拆成「章节回复」，读感会更像一篇温柔的连载。</span>
          </div>
        </div>
      </div>

      <aside className="col-right">
        <div className="card clock-card" aria-live="polite">
          <div className="digital-time">{timeText}</div>
        </div>

        <div className="card calendar-card">
          <div className="cal-head">
            <div className="cal-head-titles">
              <span className="cal-greg">
                {year} 年 {monthLabel} 月
              </span>
              {lunarMonthTitle ? (
                <span className="cal-lunar-hint" title="以月中为参考的农历年、月">
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
          <div className="cal-grid" role="grid" aria-label="月历">
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
        </div>

        <div className="card music-card">
          <div className="track-row">
            <p className="track-name">Close To You — Carpenters</p>
            <button className="play-circle" type="button" aria-label="播放（示意）">
              <Play size={18} fill="currentColor" className="play-icon" />
            </button>
          </div>
          <div className="progress" aria-hidden>
            <div className="progress-inner" />
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
