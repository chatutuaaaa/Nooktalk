import { useEffect, useState } from "react";
import { getGreeting } from "../../forum/utils.js";
import { useMusicPlayback } from "../../useMusicPlayback.js";

export function MobileHomePage({ isLoggedIn, currentUser, onNavigate, onAuth }) {
  const [weather, setWeather] = useState(null);
  const { hasTracks, cur, playing, togglePlay } = useMusicPlayback();
  const hour = new Date().getHours();
  const { label: greetLabel } = getGreeting(hour);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/weather");
        const data = await res.json();
        if (!cancelled) setWeather(data);
      } catch {
        if (!cancelled) setWeather(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = [
    { id: "posts", title: "帖子广场", sub: "浏览与发帖" },
    { id: "recent", title: "最新讨论", sub: "按时间排序" },
    { id: "columns", title: "精品专栏", sub: "分类精选" },
    { id: "share", title: "推荐分享", sub: "链接与转发" },
    { id: "schedule", title: "日程日历", sub: "待办与农历" },
    { id: "weather", title: "未来天气", sub: "多日预报" },
    { id: "time", title: "时间工具", sub: "秒表倒计时" },
    { id: "music", title: "本地音乐", sub: "播放曲库" },
    { id: "about", title: "关于隅言", sub: "项目说明" },
  ];

  if (isLoggedIn) {
    tiles.push({ id: "my-posts", title: "作品中心", sub: "我的帖子" });
    if (currentUser?.isSuperuser) {
      tiles.push({ id: "admin", title: "管理后台", sub: "站点管理" });
    }
  }

  return (
    <div>
      <section className="m-card">
        <p className="m-muted" style={{ marginBottom: 4 }}>
          {greetLabel}
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
          {isLoggedIn ? `你好，${currentUser.username}` : "你好，隅友"}
        </h2>
        <p className="m-muted">移动端已适配，完整功能均可使用。</p>
        <div className="m-btn-row" style={{ marginTop: 12 }}>
          {isLoggedIn ? (
            <button type="button" className="m-btn m-btn--primary" onClick={() => onNavigate("profile")}>
              个人中心
            </button>
          ) : (
            <>
              <button type="button" className="m-btn m-btn--primary" onClick={() => onAuth("login")}>
                登录
              </button>
              <button type="button" className="m-btn m-btn--ghost" onClick={() => onAuth("register")}>
                注册
              </button>
            </>
          )}
        </div>
      </section>

      {weather?.ok ? (
        <section
          className="m-card m-weather-mini"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("weather")}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("weather")}
        >
          <img src={weather.weatherIcon || "/weather/cloudy.svg"} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{weather.weatherLocation || "天气"}</p>
            <p className="m-muted" style={{ margin: "4px 0 0" }}>
              {weather.live?.weather} · {weather.live?.temperatureC}°C
            </p>
          </div>
        </section>
      ) : null}

      {hasTracks ? (
        <section className="m-card">
          <p className="m-section-title">正在播放</p>
          <p style={{ margin: "0 0 8px" }}>{cur?.title}</p>
          <button type="button" className="m-btn m-btn--ghost" onClick={togglePlay}>
            {playing ? "暂停" : "播放"}
          </button>
          <button type="button" className="m-btn m-btn--primary" style={{ marginLeft: 8 }} onClick={() => onNavigate("music")}>
            打开播放器
          </button>
        </section>
      ) : null}

      <p className="m-section-title">功能入口</p>
      <div className="m-grid-2">
        {tiles.map((t) => (
          <button key={t.id} type="button" className="m-tile" onClick={() => onNavigate(t.id)}>
            <strong>{t.title}</strong>
            <span>{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
