import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Heart,
  Link2,
  ListOrdered,
  MapPin,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-php";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import codeSyntaxHighlight from "@toast-ui/editor-plugin-code-syntax-highlight";
import { createWysiwygCodeBlockPlugin } from "./wysiwygCodeBlockView.js";
import { getLunarDayLabel, getLunarMonthTitle } from "./lunarUtil";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { MusicPlayer } from "./MusicPlayer";
import { useMusicPlayback } from "./useMusicPlayback.js";
import { TimeTools } from "./TimeTools";
import { WeatherWeek } from "./WeatherWeek";
import commentIcon from "./assets/comment.svg";
import likeIcon from "./assets/like.svg";
import previewOpenIcon from "./assets/preview-open.svg";
import closeIcon from "./assets/close.svg";
import searchIcon from "./assets/search.svg";
import deleteIcon from "./assets/delete.svg";
import editIcon from "./assets/edit.svg";
import undoIcon from "./assets/undo.svg";
import copyOneIcon from "./assets/copy-one.svg";
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

function postsPathname() {
  return new URL("posts", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function recentPathname() {
  return new URL("recent", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function myPostsPathname() {
  return new URL("my-posts", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function profilePathname() {
  return new URL("profile", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function profileReceivedLikesPathname() {
  return new URL("profile/received-likes", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function profileReceivedCommentsPathname() {
  return new URL("profile/received-comments", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function postsComposePathname() {
  return new URL("posts/new", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function isPostsComposePathname(pathname = window.location.pathname) {
  return pathname === postsComposePathname();
}

function postsDetailPathname(postId) {
  return new URL(`posts/${postId}`, `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function adminPathname() {
  return new URL("admin", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function postsDetailIdFromPathname(pathname = window.location.pathname) {
  const base = postsPathname().replace(/\/$/, "");
  const p = String(pathname || "").replace(/\/$/, "");
  const m = p.match(new RegExp(`^${base}/(\\d+)$`));
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function viewFromPathname() {
  const p = window.location.pathname;
  if (p === schedulePathname()) return "schedule";
  if (p === weatherPathname()) return "weather";
  if (p === timePathname()) return "time";
  if (p === musicPathname()) return "music";
  if (p === recentPathname()) return "recent";
  if (p === profileReceivedLikesPathname()) return "profile-likes";
  if (p === profileReceivedCommentsPathname()) return "profile-comments";
  if (p === profilePathname()) return "profile";
  if (p === adminPathname()) return "admin";
  if (p === myPostsPathname()) return "my-posts";
  if (p === postsPathname() || p === postsComposePathname() || postsDetailIdFromPathname(p)) return "posts";
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

function pickNextGreetingIndex(total, prev) {
  if (total <= 1) return 0;
  let next = Math.floor(Math.random() * total);
  if (next === prev) {
    next = (next + 1) % total;
  }
  return next;
}

function avatarFromUsername(username) {
  const seed = encodeURIComponent((username || "nooktalk").trim() || "nooktalk");
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;
}

/** 将本地图片压到最长边 256px 的 JPEG data URL，便于 PATCH 存库 */
function fileToResizedJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxSide = 256;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error("无法读取图片尺寸"));
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法处理图片"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("转换失败"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

function normalizeMarkdownInput(input) {
  let normalized = String(input || "");
  if (!normalized.includes("\n") && normalized.includes("\\n")) {
    normalized = normalized.replace(/\\n/g, "\n");
  }
  if (/\\[`*_#[\]()>-]/.test(normalized)) {
    normalized = normalized.replace(/\\([`*_#[\]()>-])/g, "$1");
  }
  return normalized;
}

/** 与详情页同一套代码块高亮渲染，供全文与列表摘要共用 */
function buildPostMarkdownRenderer() {
  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (ch) => {
      if (ch === "&") return "&amp;";
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === '"') return "&quot;";
      return "&#39;";
    });
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = String(lang || "").trim().toLowerCase();
    const languageLabel = language || "plain";
    const source = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, "    ");
    const encodedSource = encodeURIComponent(source);
    const rows = source.split("\n");
    const lineHtml = rows
      .map((line, idx) => {
        const highlighted =
          language && hljs.getLanguage(language)
            ? hljs.highlight(line || " ", { language, ignoreIllegals: true }).value
            : escapeHtml(line || " ");
        return `<span class="md-code-line"><span class="md-code-line-no">${idx + 1}</span><span class="md-code-line-content">${highlighted}</span></span>`;
      })
      .join("");
    return `<div class="md-code-block"><div class="md-code-head"><span class="md-code-lang">${escapeHtml(languageLabel)}</span><button type="button" class="md-code-copy" data-code="${encodedSource}" aria-label="复制代码"><img src="${copyOneIcon}" alt="" /></button></div><pre><code class="hljs language-${escapeHtml(languageLabel)}">${lineHtml}</code></pre></div>`;
  };
  return renderer;
}

const postMarkdownRenderer = buildPostMarkdownRenderer();

function renderMarkdown(mdText) {
  try {
    const normalized = normalizeMarkdownInput(mdText);
    const raw = marked.parse(normalized, { gfm: true, breaks: true, renderer: postMarkdownRenderer });
    return DOMPurify.sanitize(raw);
  } catch {
    return "";
  }
}

/** 列表卡片摘要：保留换行并用完整 Markdown 解析（与详情一致），仅做长度截断 */
function renderMarkdownSnippet(mdText, maxChars = 360) {
  const normalized = normalizeMarkdownInput(mdText).trim();
  if (!normalized.length) return "";
  let snippet = normalized;
  if (normalized.length > maxChars) {
    let cut = normalized.slice(0, maxChars);
    const lastNl = cut.lastIndexOf("\n");
    if (lastNl > maxChars * 0.45) {
      cut = cut.slice(0, lastNl);
    }
    snippet = `${cut.trimEnd()}…`;
  }
  try {
    const raw = marked.parse(snippet, { gfm: true, breaks: true, renderer: postMarkdownRenderer });
    return DOMPurify.sanitize(raw);
  } catch {
    return "";
  }
}

function formatPostTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "时间未知";
  try {
    return new Date(n).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "时间未知";
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

function AdminDashboard({ authToken, currentUser, onNeedLogin, onBackHome }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeMetric, setActiveMetric] = useState("users");
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricError, setMetricError] = useState("");
  const [postsData, setPostsData] = useState([]);
  const [commentsData, setCommentsData] = useState([]);
  const [likesData, setLikesData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const loadAll = useCallback(async () => {
    setErr("");
    if (!authToken) {
      setErr("请先登录后访问后台。");
      setLoading(false);
      setStats(null);
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${authToken}` };
      const r1 = await fetch("/api/admin/stats", { headers: h });
      const j1 = await r1.json();
      if (!r1.ok)
        throw new Error(typeof j1?.detail === "string" ? j1.detail : "加载统计失败");
      setStats(j1);
      const r2 = await fetch("/api/admin/users?limit=100", { headers: h });
      const j2 = await r2.json();
      if (!r2.ok)
        throw new Error(typeof j2?.detail === "string" ? j2.detail : "加载用户失败");
      setUsers(Array.isArray(j2.items) ? j2.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
      setStats(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadPostsData = useCallback(async () => {
    if (!authToken) return;
    if (postsData.length) return;
    const h = { Authorization: `Bearer ${authToken}` };
    const res = await fetch("/api/posts?tag=全部&limit=100&offset=0", { headers: h });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "加载帖子失败");
    setPostsData(Array.isArray(data?.items) ? data.items : []);
  }, [authToken, postsData.length]);

  const loadCommentsAndLikesData = useCallback(async () => {
    if (!authToken) return;
    if (commentsData.length || likesData.length) return;
    const h = { Authorization: `Bearer ${authToken}` };
    const res = await fetch("/api/posts?tag=全部&limit=100&offset=0", { headers: h });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "加载帖子失败");
    const posts = Array.isArray(data?.items) ? data.items : [];
    const detailPayloads = await Promise.all(
      posts.map(async (p) => {
        const r = await fetch(`/api/posts/${p.id}?increment_view=false`, { headers: h });
        const j = await r.json();
        if (!r.ok) return null;
        return j;
      }),
    );
    const comments = [];
    const likes = [];
    for (const detail of detailPayloads) {
      if (!detail?.item) continue;
      if ((detail.item?.stats?.likes ?? 0) > 0) {
        likes.push({
          type: "帖子",
          title: detail.item.title,
          author: detail.item.author,
          likes: Number(detail.item.stats?.likes || 0),
        });
      }
      for (const c of detail.comments || []) {
        comments.push({
          id: c.id,
          postTitle: detail.item.title,
          author: c.author,
          content: c.content,
          createdAt: c.createdAt,
          likes: Number(c.likes || 0),
        });
        if ((c.likes ?? 0) > 0) {
          likes.push({
            type: "评论",
            title: `@${c.author} · ${detail.item.title}`,
            author: c.author,
            likes: Number(c.likes || 0),
          });
        }
      }
    }
    setCommentsData(comments);
    setLikesData(likes.sort((a, b) => b.likes - a.likes));
  }, [authToken, commentsData.length, likesData.length]);

  const onSelectMetric = useCallback(
    async (key) => {
      setActiveMetric(key);
      setMetricError("");
      if (!authToken) return;
      setMetricLoading(true);
      try {
        if (key === "posts") {
          await loadPostsData();
        } else if (key === "comments" || key === "likes") {
          await loadCommentsAndLikesData();
        }
      } catch (e) {
        setMetricError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setMetricLoading(false);
      }
    },
    [authToken, loadCommentsAndLikesData, loadPostsData],
  );

  const keyword = searchTerm.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        if (!keyword) return true;
        return (
          String(u.id).includes(keyword) ||
          String(u.username || "").toLowerCase().includes(keyword) ||
          String(u.email || "").toLowerCase().includes(keyword)
        );
      }),
    [keyword, users],
  );
  const filteredSilencedUsers = useMemo(
    () => filteredUsers.filter((u) => u.isSilenced),
    [filteredUsers],
  );
  const filteredPosts = useMemo(
    () =>
      postsData.filter((p) => {
        if (!keyword) return true;
        return (
          String(p.id).includes(keyword) ||
          String(p.title || "").toLowerCase().includes(keyword) ||
          String(p.author || "").toLowerCase().includes(keyword)
        );
      }),
    [keyword, postsData],
  );
  const filteredComments = useMemo(
    () =>
      commentsData.filter((c) => {
        if (!keyword) return true;
        return (
          String(c.id).includes(keyword) ||
          String(c.postTitle || "").toLowerCase().includes(keyword) ||
          String(c.author || "").toLowerCase().includes(keyword) ||
          String(c.content || "").toLowerCase().includes(keyword)
        );
      }),
    [commentsData, keyword],
  );
  const filteredLikes = useMemo(
    () =>
      likesData.filter((l) => {
        if (!keyword) return true;
        return (
          String(l.type || "").toLowerCase().includes(keyword) ||
          String(l.title || "").toLowerCase().includes(keyword) ||
          String(l.author || "").toLowerCase().includes(keyword)
        );
      }),
    [keyword, likesData],
  );

  const onToggleSilence = async (uid, prevSilenced) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/admin/users/${uid}/silence`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ silenced: !prevSilenced }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(typeof data?.detail === "string" ? data.detail : "操作失败");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === uid ? { ...u, isSilenced: Boolean(data?.user?.isSilenced ?? !prevSilenced) } : u,
        ),
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="admin-page forum-page" lang="zh-CN">
      <header className="forum-hero my-posts-hero card">
        <div>
          <p className="forum-kicker">ADMIN</p>
          <h1 className="forum-title">管理后台</h1>
          <p className="forum-sub">{currentUser ? `管理员：${currentUser.username}` : "请先登录"}</p>
        </div>
        <div className="admin-page-actions">
          {!authToken ? (
            <button type="button" className="forum-new" onClick={() => onNeedLogin?.()}>
              登录
            </button>
          ) : null}
          <button type="button" className="forum-back" onClick={onBackHome}>
            返回首页
          </button>
        </div>
      </header>

      {loading ? <p className="forum-detail-loading card">加载中…</p> : null}
      {!loading && err ? (
        <p className="card forum-detail-loading" role="alert">
          {err}
        </p>
      ) : null}

      {!loading && !err && stats ? (
        <section className="admin-stats card">
          <h2 className="admin-section-title">全站概要</h2>
          <div className="admin-stat-grid">
            <button
              type="button"
              className={"admin-stat-cell" + (activeMetric === "users" ? " is-active" : "")}
              onClick={() => onSelectMetric("users")}
            >
              <strong>{stats.totals?.users ?? "—"}</strong>
              <span>注册用户</span>
            </button>
            <button
              type="button"
              className={"admin-stat-cell" + (activeMetric === "posts" ? " is-active" : "")}
              onClick={() => onSelectMetric("posts")}
            >
              <strong>{stats.totals?.posts ?? "—"}</strong>
              <span>帖子（未删）</span>
            </button>
            <button
              type="button"
              className={"admin-stat-cell" + (activeMetric === "comments" ? " is-active" : "")}
              onClick={() => onSelectMetric("comments")}
            >
              <strong>{stats.totals?.comments ?? "—"}</strong>
              <span>评论（未删）</span>
            </button>
            <button
              type="button"
              className={"admin-stat-cell" + (activeMetric === "likes" ? " is-active" : "")}
              onClick={() => onSelectMetric("likes")}
            >
              <strong>{stats.totals?.likes ?? "—"}</strong>
              <span>点赞记录</span>
            </button>
            <button
              type="button"
              className={"admin-stat-cell" + (activeMetric === "silenced" ? " is-active" : "")}
              onClick={() => onSelectMetric("silenced")}
            >
              <strong>{stats.totals?.silencedUsers ?? "—"}</strong>
              <span>当前禁言</span>
            </button>
          </div>
          <div className="admin-today">
            <h3>今日增量</h3>
            <p>
              新用户 {stats.today?.newUsers ?? "—"} · 新帖 {stats.today?.newPosts ?? "—"} · 新评论{" "}
              {stats.today?.newComments ?? "—"}
            </p>
          </div>
        </section>
      ) : null}

      {!loading && !err && stats ? (
        <section className="card admin-users-section">
          <div className="admin-section-head">
            <h2 className="admin-section-title">
              {activeMetric === "users"
                ? "注册用户"
                : activeMetric === "posts"
                  ? "帖子数据"
                  : activeMetric === "comments"
                    ? "评论数据"
                    : activeMetric === "likes"
                      ? "点赞数据"
                      : "禁言用户"}
            </h2>
            <label className="admin-search">
              <img src={searchIcon} alt="" aria-hidden="true" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索ID/用户名/标题/内容"
              />
            </label>
          </div>
          {metricLoading ? <p className="admin-muted">加载中…</p> : null}
          {!metricLoading && metricError ? <p className="admin-muted">{metricError}</p> : null}
          {!metricLoading && !metricError && activeMetric === "users" && filteredUsers.length ? (
            <div className="admin-users-scroll">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>邮箱</th>
                    <th>注册时间</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{formatPostTime(u.createdAt)}</td>
                      <td>{u.isSuperuser ? "管理员" : u.isSilenced ? "禁言中" : "正常"}</td>
                      <td>
                        {!u.isSuperuser ? (
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={!authToken}
                            onClick={() => onToggleSilence(u.id, Boolean(u.isSilenced))}
                          >
                            {u.isSilenced ? "解封" : "禁言"}
                          </button>
                        ) : (
                          <span className="admin-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!metricLoading && !metricError && activeMetric === "users" && !filteredUsers.length ? (
            <p className="admin-muted">暂无用户</p>
          ) : null}

          {!metricLoading && !metricError && activeMetric === "silenced" ? (
            <div className="admin-users-scroll">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>邮箱</th>
                    <th>注册时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSilencedUsers.length ? (
                    filteredSilencedUsers.map((u) => (
                        <tr key={`silenced-${u.id}`}>
                          <td>{u.id}</td>
                          <td>{u.username}</td>
                          <td>{u.email}</td>
                          <td>{formatPostTime(u.createdAt)}</td>
                          <td>禁言中</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5}>暂无禁言用户</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {!metricLoading && !metricError && activeMetric === "posts" ? (
            <div className="admin-users-scroll">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>标题</th>
                    <th>作者</th>
                    <th>评论</th>
                    <th>点赞</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.length ? (
                    filteredPosts.map((p) => (
                      <tr key={`post-${p.id}`}>
                        <td>{p.id}</td>
                        <td>{p.title}</td>
                        <td>{p.author}</td>
                        <td>{p.stats?.comments ?? 0}</td>
                        <td>{p.stats?.likes ?? 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>暂无帖子数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {!metricLoading && !metricError && activeMetric === "comments" ? (
            <div className="admin-users-scroll">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>所属帖子</th>
                    <th>作者</th>
                    <th>发布时间</th>
                    <th>内容</th>
                    <th>点赞</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComments.length ? (
                    filteredComments.map((c) => (
                      <tr key={`comment-${c.id}`}>
                        <td>{c.id}</td>
                        <td>{c.postTitle}</td>
                        <td>{c.author}</td>
                        <td>{formatPostTime(c.createdAt)}</td>
                        <td>{c.content}</td>
                        <td>{c.likes}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>暂无评论数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {!metricLoading && !metricError && activeMetric === "likes" ? (
            <div className="admin-users-scroll">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>对象</th>
                    <th>作者</th>
                    <th>点赞数</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLikes.length ? (
                    filteredLikes.map((l, idx) => (
                      <tr key={`like-${idx}`}>
                        <td>{l.type}</td>
                        <td>{l.title}</td>
                        <td>{l.author}</td>
                        <td>{l.likes}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>暂无点赞数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MyPostsBoard({ authToken, currentUser, onNeedLogin, onBackHome, onOpenPost, onEditPost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTargetPostId, setDeleteTargetPostId] = useState(null);
  const [postView, setPostView] = useState(() => {
    const st = typeof window !== "undefined" ? window.history.state || {} : {};
    return st?.myPostsTab === "deleted" ? "deleted" : "active";
  });

  const normalizeError = useCallback((detail, fallbackText) => {
    if (!detail) return fallbackText;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && typeof first.msg === "string") return first.msg;
      return fallbackText;
    }
    if (typeof detail === "object" && typeof detail.msg === "string") return detail.msg;
    return fallbackText;
  }, []);

  const loadMine = useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      setItems([]);
      setError("请先登录");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts/mine?limit=200&include_deleted=true", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems(Array.isArray(data?.items) ? data.items : []);
        return;
      }

      // 兼容后端尚未重启时 /posts/mine 被 /posts/{post_id} 捕获的情况：前端兜底筛我的帖子
      const fallbackRes = await fetch("/api/posts?tag=全部&limit=100&offset=0", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const fallbackData = await fallbackRes.json();
      if (!fallbackRes.ok) {
        throw new Error(normalizeError(data?.detail, "加载失败"));
      }
      const all = Array.isArray(fallbackData?.items) ? fallbackData.items : [];
      const mine = all.filter((p) => Number(p?.authorId) === Number(currentUser?.id));
      setItems(mine);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [authToken, currentUser?.id, normalizeError]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const keyword = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      items
        .filter((p) => (postView === "deleted" ? Boolean(p.deleted) : !Boolean(p.deleted)))
        .filter((p) => {
        if (!keyword) return true;
        return (
          String(p?.title || "").toLowerCase().includes(keyword) ||
          String(p?.tag || "").toLowerCase().includes(keyword) ||
          String(p?.excerpt || "").toLowerCase().includes(keyword) ||
          String(p?.body || "").toLowerCase().includes(keyword)
        );
      }),
    [items, keyword, postView],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== myPostsPathname()) return;
    const st = window.history.state || {};
    window.history.replaceState({ ...st, myPostsTab: postView }, "", myPostsPathname());
  }, [postView]);

  const onDeleteMinePost = useCallback(
    async (e, postId) => {
      e.stopPropagation();
      setDeleteTargetPostId(postId);
    },
    [],
  );

  const confirmDeleteMinePost = useCallback(async () => {
    const postId = deleteTargetPostId;
    if (!postId) return;
    if (!authToken) {
      setDeleteTargetPostId(null);
      onNeedLogin?.();
      return;
    }
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "删除失败");
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, deleted: true } : p)));
      setDeleteTargetPostId(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "删除失败");
    }
  }, [authToken, deleteTargetPostId, onNeedLogin]);

  const onRestoreMinePost = useCallback(
    async (e, postId) => {
      e.stopPropagation();
      if (!authToken) {
        onNeedLogin?.();
        return;
      }
      try {
        const res = await fetch(`/api/posts/${postId}/restore`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "恢复失败");
        setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, ...(data?.item || {}), deleted: false } : p)));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "恢复失败");
      }
    },
    [authToken, onNeedLogin],
  );

  return (
    <div className="forum-page" lang="zh-CN">
      <header className="forum-hero card">
        <div>
          <p className="forum-kicker">MY POSTS</p>
          <h1 className="forum-title">作品中心</h1>
          <p className="forum-sub">
            {currentUser ? `@${currentUser.username} 的帖子` : "登录后可查看我的帖子"}
          </p>
        </div>
        <div className="admin-page-actions">
          {!authToken ? (
            <button type="button" className="forum-new" onClick={() => onNeedLogin?.()}>
              登录
            </button>
          ) : null}
          <button type="button" className="forum-back" onClick={onBackHome}>
            返回首页
          </button>
        </div>
      </header>

      <section className="my-posts-section">
        <div className="my-posts-head">
          <div className="my-post-tabs" role="tablist" aria-label="帖子视图">
            <button
              type="button"
              className={"my-post-tab" + (postView === "active" ? " active" : "")}
              onClick={() => setPostView("active")}
            >
              我发布的帖子
            </button>
            <button
              type="button"
              className={"my-post-tab" + (postView === "deleted" ? " active" : "")}
              onClick={() => setPostView("deleted")}
            >
              最近删除的帖子
            </button>
          </div>
          <label className="admin-search">
            <img src={searchIcon} alt="" aria-hidden="true" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标题/标签/内容"
            />
          </label>
        </div>
        {loading ? <p className="admin-muted">加载中…</p> : null}
        {!loading && error ? <p className="admin-muted">{error}</p> : null}
        {!loading && !error && !items.length ? <p className="admin-muted">你还没有发布帖子</p> : null}
        {!loading && !error && items.length && !filteredItems.length ? (
          <p className="admin-muted">没有匹配的帖子</p>
        ) : null}
        {!loading && !error && filteredItems.length ? (
          <div className="my-posts-list">
            {filteredItems.map((p) => (
              <article
                key={`mine-${p.id}`}
                className="card forum-post forum-post-btn my-post-item"
                role="button"
                tabIndex={0}
                onClick={() => onOpenPost?.(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPost?.(p.id);
                  }
                }}
              >
                <button
                  type="button"
                  className="my-post-edit-btn"
                  title="编辑帖子"
                  aria-label="编辑帖子"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPost?.(p, postView);
                  }}
                >
                  <img src={editIcon} alt="" />
                </button>
                {postView === "deleted" ? (
                  <button
                    type="button"
                    className="my-post-restore-btn"
                    title="恢复帖子"
                    aria-label="恢复帖子"
                    onClick={(e) => onRestoreMinePost(e, p.id)}
                  >
                    <img src={undoIcon} alt="" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="my-post-delete-btn"
                    title="删除帖子"
                    aria-label="删除帖子"
                    onClick={(e) => onDeleteMinePost(e, p.id)}
                  >
                    <img src={deleteIcon} alt="" />
                  </button>
                )}
                <div className="forum-post-title-row">
                  <h3 className="forum-post-title">{p.title}</h3>
                  <div className="forum-post-tags-inline">
                    {Array.isArray(p.topics)
                      ? p.topics.map((t) => (
                          <span key={`mine-topic-${p.id}-${t}`} className="forum-topic-chip">
                            #{t}
                          </span>
                        ))
                      : null}
                    {p.tag ? <span className="forum-tag">{p.tag}</span> : null}
                    {p.pinned ? <span className="forum-pinned">置顶</span> : null}
                  </div>
                </div>
                <div
                  className="markdown-body forum-post-excerpt-md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(p.body || p.excerpt || "") }}
                />
                <div className="forum-post-foot forum-post-foot--split">
                  <span className="forum-stat forum-post-time">发布于 {formatPostTime(p.createdAt)}</span>
                  <div className="forum-post-foot-right">
                    <span className="forum-stat">
                      <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                      {p.stats?.views ?? 0}
                    </span>
                    <span className="forum-stat">
                      <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                      {p.stats?.comments ?? 0}
                    </span>
                    <span className="forum-stat">
                      <img src={likeIcon} alt="点赞数" className="forum-stat-icon" />
                      {p.stats?.likes ?? 0}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {deleteTargetPostId ? (
        <div className="auth-modal-mask" role="dialog" aria-modal="true" aria-label="删除帖子确认">
          <div className="auth-modal">
            <div className="auth-modal-head">
              <h3>确认删除</h3>
              <button type="button" className="auth-modal-close" onClick={() => setDeleteTargetPostId(null)}>
                ×
              </button>
            </div>
            <p className="admin-muted">删除后帖子会进入“最近删除的帖子”，30 天内可恢复。</p>
            <div className="auth-actions delete-confirm-actions">
              <button type="button" className="auth-switch" onClick={() => setDeleteTargetPostId(null)}>
                取消
              </button>
              <button type="button" className="auth-submit" onClick={confirmDeleteMinePost}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileCenterBoard({
  authToken,
  currentUser,
  onNeedLogin,
  onBackHome,
  onOpenMyPosts,
  onOpenReceivedLikes,
  onOpenReceivedComments,
  onLogout,
  onOpenPost,
  onUserUpdated,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    postCount: 0,
    activePostCount: 0,
    deletedPostCount: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    latestPostAt: 0,
  });
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [avatarInput, setAvatarInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErr, setProfileErr] = useState("");
  const avatarFileInputRef = useRef(null);

  const loadSummary = useCallback(async () => {
    if (!authToken || !currentUser) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts/mine?include_deleted=true&limit=200", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "个人中心数据加载失败");
      const mine = Array.isArray(data?.items) ? data.items : [];
      const next = mine.reduce(
        (acc, p) => {
          const views = Number(p?.stats?.views || 0);
          const likes = Number(p?.stats?.likes || 0);
          const comments = Number(p?.stats?.comments || 0);
          const createdAt = Number(p?.createdAt || 0);
          return {
            postCount: acc.postCount + 1,
            activePostCount: acc.activePostCount + (p?.deleted ? 0 : 1),
            deletedPostCount: acc.deletedPostCount + (p?.deleted ? 1 : 0),
            totalViews: acc.totalViews + views,
            totalLikes: acc.totalLikes + likes,
            totalComments: acc.totalComments + comments,
            latestPostAt: Math.max(acc.latestPostAt, createdAt),
          };
        },
        {
          postCount: 0,
          activePostCount: 0,
          deletedPostCount: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          latestPostAt: 0,
        },
      );
      setSummary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "个人中心数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [authToken, currentUser]);

  const loadNotifications = useCallback(async () => {
    if (!authToken) return;
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=40", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.items)) setNotifications(data.items);
      else setNotifications([]);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !currentUser) {
      setLoading(false);
      setSummary({
        postCount: 0,
        activePostCount: 0,
        deletedPostCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        latestPostAt: 0,
      });
      setNotifications([]);
      return;
    }
    void loadSummary();
  }, [authToken, currentUser, loadSummary]);

  useEffect(() => {
    if (!authToken || !currentUser) return;
    void loadNotifications();
    const t = setInterval(() => void loadNotifications(), 45000);
    return () => clearInterval(t);
  }, [authToken, currentUser, loadNotifications]);

  const openEdit = useCallback(() => {
    setAvatarInput(currentUser.avatarUrl || "");
    setProfileErr("");
    if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
    setEditOpen(true);
  }, [currentUser]);

  const onPickLocalAvatar = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileErr("请选择图片文件");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setProfileErr("图片需小于 15MB");
      return;
    }
    setProfileErr("");
    try {
      const dataUrl = await fileToResizedJpegDataUrl(file);
      if (dataUrl.length > 380_000) {
        setProfileErr("图片处理后仍过大，请换一张较小的图");
        return;
      }
      setAvatarInput(dataUrl);
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "图片读取失败");
    }
  }, []);

  const saveProfile = useCallback(async () => {
    if (!authToken) return;
    setProfileSaving(true);
    setProfileErr("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ avatarUrl: avatarInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "保存失败");
      onUserUpdated?.(data?.user);
      setEditOpen(false);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setProfileSaving(false);
    }
  }, [authToken, avatarInput, onUserUpdated]);

  const clearAvatar = useCallback(async () => {
    if (!authToken) return;
    setProfileSaving(true);
    setProfileErr("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ avatarUrl: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "保存失败");
      onUserUpdated?.(data?.user);
      setEditOpen(false);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setProfileSaving(false);
    }
  }, [authToken, onUserUpdated]);

  const onClickNotification = useCallback(
    async (n) => {
      if (!authToken) return;
      try {
        await fetch(`/api/notifications/${n.id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        );
      } catch {
        // 仍跳转详情
      }
      onOpenPost?.(n.postId);
    },
    [authToken, onOpenPost],
  );

  const markAllRead = useCallback(async () => {
    if (!authToken) return;
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch {
      // noop
    }
  }, [authToken]);

  const markSectionRead = useCallback(
    async (kind) => {
      if (!authToken) return;
      const ids = notifications.filter((n) => !n.read && n.kind === kind).map((n) => n.id);
      for (const id of ids) {
        try {
          await fetch(`/api/notifications/${id}/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          });
        } catch {
          // ignore single failure
        }
      }
      setNotifications((prev) => prev.map((x) => (!x.read && x.kind === kind ? { ...x, read: true } : x)));
    },
    [authToken, notifications],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const likeNotifications = useMemo(
    () => notifications.filter((n) => n.kind === "post_like"),
    [notifications],
  );
  const commentNotifications = useMemo(
    () => notifications.filter((n) => n.kind === "post_comment"),
    [notifications],
  );
  const unreadLikeCount = useMemo(
    () => likeNotifications.filter((n) => !n.read).length,
    [likeNotifications],
  );
  const unreadCommentCount = useMemo(
    () => commentNotifications.filter((n) => !n.read).length,
    [commentNotifications],
  );

  if (!authToken || !currentUser) {
    return (
      <div className="forum-page profile-forum-page" lang="zh-CN">
        <div className="forum-hero card">
          <div>
            <p className="forum-kicker">PROFILE</p>
            <h1 className="forum-title">个人中心</h1>
            <p className="forum-sub">登录后可管理资料与查看消息。</p>
          </div>
          <button type="button" className="forum-back" onClick={onBackHome}>
            返回首页
          </button>
        </div>
        <section className="forum-side-card card profile-login-card">
          <h3>尚未登录</h3>
          <p className="profile-notify-hint">请先登录后查看个人数据与消息提醒。</p>
          <button type="button" className="forum-new profile-login-btn" onClick={onNeedLogin}>
            去登录
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="forum-page profile-forum-page" lang="zh-CN">
      <div className="forum-hero card">
        <div>
          <p className="forum-kicker">PROFILE</p>
          <h1 className="forum-title">个人中心</h1>
          <p className="forum-sub">
            @{currentUser.username} · {currentUser.email || "未绑定邮箱"}
            {unreadCount > 0 ? ` · 未读消息 ${unreadCount} 条` : ""}
          </p>
        </div>
        <button type="button" className="forum-back" onClick={onBackHome}>
          返回首页
        </button>
      </div>

      <div className="forum-toolbar card profile-toolbar">
        <div className="profile-toolbar-actions">
          <button type="button" className="forum-new" onClick={openEdit}>
            更改头像
          </button>
          <button type="button" className="forum-cat" onClick={() => void loadNotifications()}>
            刷新消息
          </button>
          {unreadCount > 0 ? (
            <button type="button" className="forum-cat" onClick={() => void markAllRead()}>
              全部消息已读
            </button>
          ) : null}
          <button type="button" className="forum-cat" onClick={() => onOpenMyPosts?.("active")}>
            我的帖子
          </button>
          <button type="button" className="forum-cat profile-logout-btn" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </div>

      <div className="forum-body profile-forum-body">
        <div className="profile-main-stack">
          <article className="forum-post card profile-hero-card">
            <div className="profile-center-head profile-hero-head">
              <img
                className="profile-center-avatar profile-hero-avatar"
                src={currentUser.avatarUrl || avatarFromUsername(currentUser.username)}
                alt=""
              />
              <div className="profile-center-meta">
                <h3 className="profile-hero-name">{currentUser.username}</h3>
                <p>@{currentUser.username}</p>
                <p>{currentUser.email || "未绑定邮箱"}</p>
              </div>
              <button type="button" className="forum-new profile-hero-edit" onClick={openEdit}>
                更改头像
              </button>
            </div>
            <div className="profile-center-role-row">
              <span className={"profile-role-chip" + (currentUser.isSuperuser ? " admin" : "")}>
                {currentUser.isSuperuser ? "管理员账号" : "普通账号"}
              </span>
              <span className={"profile-role-chip" + (currentUser.isSilenced ? " muted" : " ok")}>
                {currentUser.isSilenced ? "当前状态：禁言中" : "当前状态：正常"}
              </span>
            </div>
          </article>

          {error ? <article className="forum-post card"><p className="auth-error">{error}</p></article> : null}

          <div className="profile-stats-grid">
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenMyPosts?.("active")}
              aria-label="查看我的帖子（全部）"
            >
              <span>帖子总数</span>
              <strong>{loading ? "…" : summary.postCount}</strong>
            </button>
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenMyPosts?.("active")}
              aria-label="查看我发布的公开帖子"
            >
              <span>公开帖子</span>
              <strong>{loading ? "…" : summary.activePostCount}</strong>
            </button>
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenMyPosts?.("active")}
              aria-label="在我的帖子中查看浏览数据"
            >
              <span>总浏览</span>
              <strong>{loading ? "…" : summary.totalViews}</strong>
            </button>
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenReceivedLikes?.()}
              aria-label="查看谁点赞了我的帖子"
            >
              <span>总点赞</span>
              <strong>{loading ? "…" : summary.totalLikes}</strong>
            </button>
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenReceivedComments?.()}
              aria-label="查看谁评论了我的帖子"
            >
              <span>总评论</span>
              <strong>{loading ? "…" : summary.totalComments}</strong>
            </button>
            <button
              type="button"
              className="profile-stat-card profile-stat-card--action"
              onClick={() => onOpenMyPosts?.("deleted")}
              aria-label="查看最近删除的帖子"
            >
              <span>回收站</span>
              <strong>{loading ? "…" : summary.deletedPostCount}</strong>
            </button>
          </div>
          <p className="profile-center-last profile-last-line">
            最近发帖：{summary.latestPostAt ? formatPostTime(summary.latestPostAt) : "暂无记录"}
          </p>
        </div>

        <aside className="forum-side profile-side">
          <div className="profile-notify-stack">
            <div className="forum-side-card card profile-notify-card">
              <div className="profile-notify-head">
                <h3>点赞提醒</h3>
                {unreadLikeCount > 0 ? (
                  <button type="button" className="profile-notify-markall" onClick={() => void markSectionRead("post_like")}>
                    全部已读
                  </button>
                ) : null}
              </div>
              {notifLoading ? (
                <p className="profile-notify-hint">加载中…</p>
              ) : !likeNotifications.length ? (
                <p className="profile-notify-hint">暂无点赞消息。</p>
              ) : (
                <ol className="profile-notify-list">
                  {likeNotifications.map((n) => (
                    <li key={n.id} className={"profile-notify-item" + (n.read ? "" : " unread")}>
                      <button type="button" className="profile-notify-btn" onClick={() => void onClickNotification(n)}>
                        <span className="profile-notify-like-line">
                          <span className="profile-notify-actor">@{n.actorUsername}</span>
                          <span className="profile-notify-title"> 赞了你的帖子「{n.postTitle}」</span>
                        </span>
                        <span className="profile-notify-time">{formatPostTime(n.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <p className="profile-notify-foot">点击一条消息可标记已读并打开对应帖子。</p>
            </div>
            <div className="forum-side-card card profile-notify-card">
              <div className="profile-notify-head">
                <h3>评论提醒</h3>
                {unreadCommentCount > 0 ? (
                  <button
                    type="button"
                    className="profile-notify-markall"
                    onClick={() => void markSectionRead("post_comment")}
                  >
                    全部已读
                  </button>
                ) : null}
              </div>
              {notifLoading ? (
                <p className="profile-notify-hint">加载中…</p>
              ) : !commentNotifications.length ? (
                <p className="profile-notify-hint">暂无评论消息。</p>
              ) : (
                <ol className="profile-notify-list">
                  {commentNotifications.map((n) => (
                    <li key={n.id} className={"profile-notify-item" + (n.read ? "" : " unread")}>
                      <button
                        type="button"
                        className="profile-notify-btn profile-notify-btn--comment"
                        onClick={() => void onClickNotification(n)}
                      >
                        <div className="profile-notify-comment-top">
                          <span className="profile-notify-comment-main">
                            @{n.actorUsername} 评论了「{n.postTitle}」
                          </span>
                          {n.snippet ? (
                            <span className="profile-notify-snippet-end" title={n.snippet}>
                              {n.snippet}
                            </span>
                          ) : null}
                        </div>
                        <span className="profile-notify-time">{formatPostTime(n.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <p className="profile-notify-foot">点击一条消息可标记已读并打开对应帖子。</p>
            </div>
          </div>
        </aside>
      </div>

      {editOpen ? (
        <div className="auth-modal-mask" role="dialog" aria-modal="true" aria-label="更改头像">
          <div className="auth-modal profile-edit-modal">
            <div className="auth-modal-head">
              <h3>更改头像</h3>
              <button type="button" className="auth-modal-close" onClick={() => setEditOpen(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <p className="profile-notify-hint">
              可从本机选择图片，将自动压缩后保存。也可填写 https 图片链接。留空并保存则使用默认头像。
            </p>
            <div className="profile-avatar-preview-wrap">
              <img
                className="profile-avatar-preview-img"
                src={
                  avatarInput && (avatarInput.startsWith("http") || avatarInput.startsWith("data:"))
                    ? avatarInput
                    : currentUser.avatarUrl || avatarFromUsername(currentUser.username)
                }
                alt=""
              />
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              className="profile-avatar-file-input"
              accept="image/jpeg,image/png,image/webp,image/gif,image/jpg"
              onChange={onPickLocalAvatar}
              aria-label="选择本地图片文件"
            />
            <div className="profile-avatar-file-row">
              <button
                type="button"
                className="forum-cat profile-avatar-file-btn"
                disabled={profileSaving}
                onClick={() => avatarFileInputRef.current?.click()}
              >
                选择本地图片
              </button>
              {avatarInput.startsWith("data:") ? (
                <span className="admin-muted profile-avatar-file-note">已选择本地图片，保存后生效</span>
              ) : null}
            </div>
            <label className="auth-field">
              <span>或填写图片链接（https）</span>
              <input
                type="url"
                value={avatarInput.startsWith("data:") ? "" : avatarInput}
                onChange={(e) => setAvatarInput(e.target.value)}
                placeholder="https://example.com/avatar.png"
                disabled={profileSaving}
              />
            </label>
            {profileErr ? <p className="auth-error">{profileErr}</p> : null}
            <div className="auth-actions">
              <button type="button" className="auth-submit" disabled={profileSaving} onClick={() => void saveProfile()}>
                {profileSaving ? "保存中…" : "保存"}
              </button>
              <button type="button" className="auth-switch" disabled={profileSaving} onClick={() => void clearAvatar()}>
                使用默认头像
              </button>
              <button type="button" className="auth-cancel" disabled={profileSaving} onClick={() => setEditOpen(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileEngagementBoard({ kind, authToken, currentUser, onNeedLogin, onBackHome, onBackProfile, onOpenPost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const isLikes = kind === "likes";
  const kicker = isLikes ? "LIKES" : "COMMENTS";
  const title = isLikes ? "收到的赞" : "收到的评论";
  const sub = isLikes ? "每条记录为一次点赞：用户、帖子与时间" : "每条记录为一条评论：用户、帖子摘要与时间";

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ limit: "200", interaction: isLikes ? "likes" : "comments" });
      const res = await fetch(`/api/posts/mine?${q.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("服务器返回异常，请确认已重启后端并包含最新接口");
      }
      if (!res.ok) {
        const d = data?.detail;
        const msg =
          typeof d === "string" ? d : Array.isArray(d) && d[0]?.msg ? d[0].msg : res.status === 404 ? "接口不存在（请重启后端服务）" : "加载失败";
        throw new Error(msg);
      }
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      if (rawItems.length && rawItems[0].excerpt !== undefined && rawItems[0].actorUsername === undefined) {
        throw new Error("当前 API 未识别互动查询参数，请更新并重启后端服务");
      }
      setItems(rawItems);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authToken, isLikes]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!authToken || !currentUser) {
    return (
      <div className="forum-page profile-forum-page" lang="zh-CN">
        <div className="forum-hero card">
          <div>
            <p className="forum-kicker">{kicker}</p>
            <h1 className="forum-title">{title}</h1>
            <p className="forum-sub">登录后可查看与您帖子相关的互动记录。</p>
          </div>
          <button type="button" className="forum-back" onClick={onBackHome}>
            返回首页
          </button>
        </div>
        <section className="forum-side-card card profile-login-card">
          <h3>尚未登录</h3>
          <p className="profile-notify-hint">请先登录后查看。</p>
          <button type="button" className="forum-new profile-login-btn" onClick={onNeedLogin}>
            去登录
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="forum-page profile-forum-page profile-engagement-page" lang="zh-CN">
      <header className="forum-hero card">
        <div>
          <p className="forum-kicker">{kicker}</p>
          <h1 className="forum-title">{title}</h1>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="forum-cat" onClick={onBackProfile}>
            返回个人中心
          </button>
          <button type="button" className="forum-back" onClick={onBackHome}>
            返回首页
          </button>
        </div>
      </header>

      <section className="my-posts-section profile-engagement-section">
        <div className="my-posts-head profile-engagement-head">
          <p className="admin-muted profile-engagement-head-text">{sub}</p>
        </div>
        <div className="my-posts-list profile-engagement-scroll" aria-busy={loading}>
          {loading ? <article className="forum-post card profile-engagement-row">加载中…</article> : null}
          {!loading && error ? (
            <article className="forum-post card profile-engagement-row auth-error">{error}</article>
          ) : null}
          {!loading && !error && !items.length ? (
            <article className="forum-post card profile-engagement-row">
              {isLikes ? "暂时还没有点赞记录" : "暂时还没有评论记录"}
            </article>
          ) : null}
          {!loading &&
            !error &&
            items.map((row) => {
              const pt = row.postTitle || "（无标题）";
              const main = isLikes
                ? `「${row.actorUsername || "用户"}」点赞了帖子「${pt}」`
                : `「${row.actorUsername || "用户"}」评论了帖子「${pt}」`;
              return (
                <button
                  key={`${kind}-${row.id}`}
                  type="button"
                  className="forum-post forum-post-btn card profile-engagement-row"
                  onClick={() => onOpenPost?.(row.postId)}
                >
                  {isLikes ? (
                    <>
                      <p className="profile-engagement-mainline">
                        {main}
                        {row.postDeleted ? <span className="profile-engagement-badge">帖子已删除</span> : null}
                      </p>
                      <p className="profile-engagement-time">{formatPostTime(row.createdAt)}</p>
                    </>
                  ) : (
                    <>
                      <div className="profile-engagement-toprow">
                        <p className="profile-engagement-mainline profile-engagement-mainline--shrink">
                          {main}
                          {row.postDeleted ? <span className="profile-engagement-badge">帖子已删除</span> : null}
                        </p>
                        {row.snippet?.trim() ? (
                          <p
                            className="profile-engagement-snippet profile-engagement-snippet--end"
                            title={row.snippet}
                          >
                            {row.snippet}
                          </p>
                        ) : null}
                      </div>
                      <p className="profile-engagement-time">{formatPostTime(row.createdAt)}</p>
                    </>
                  )}
                </button>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function RecentPostsBoard({ onBackHome, onOpenPost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const PAGE_SIZE = 100;

  const normalizeError = useCallback((detail, fallbackText) => {
    if (!detail) return fallbackText;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && typeof first.msg === "string") return first.msg;
      return fallbackText;
    }
    if (typeof detail === "object" && typeof detail.msg === "string") return detail.msg;
    return fallbackText;
  }, []);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const offset = page * PAGE_SIZE;
      const res = await fetch(`/api/posts?tag=全部&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeError(data?.detail, "加载失败"));
      const rows = Array.isArray(data?.items) ? data.items : [];
      rows.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
      setItems(rows);
      setHasNext(rows.length >= PAGE_SIZE);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "加载失败");
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [normalizeError, page]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  return (
    <div className="forum-page" lang="zh-CN">
      <header className="forum-hero card">
        <div>
          <p className="forum-kicker">RECENT DISCUSSIONS</p>
          <h1 className="forum-title">最新讨论</h1>
          <p className="forum-sub">按发帖时间排序（最新在上）</p>
        </div>
        <button type="button" className="forum-back" onClick={onBackHome}>
          返回首页
        </button>
      </header>

      <section className="my-posts-list">
        {loading ? <article className="forum-post card">帖子加载中...</article> : null}
        {!loading && error ? <article className="forum-post card">加载失败：{error}</article> : null}
        {!loading && !error && !items.length ? (
          <article className="forum-post card">暂无帖子</article>
        ) : null}
        {!loading &&
          !error &&
          items.map((post) => (
            <button
              key={post.id}
              type="button"
              className="forum-post forum-post-btn card"
              onClick={() => onOpenPost?.(post.id)}
            >
              <div className="forum-post-title-row">
                <h3 className="forum-post-title">{post.title}</h3>
                <div className="forum-post-tags-inline">
                  {Array.isArray(post.topics)
                    ? post.topics.map((t) => (
                        <span key={`${post.id}-topic-${t}`} className="forum-topic-chip">
                          #{t}
                        </span>
                      ))
                    : null}
                  {post.tag ? <span className="forum-tag">{post.tag}</span> : null}
                  {post.pinned ? <span className="forum-pinned">置顶</span> : null}
                </div>
              </div>
              <div
                className="markdown-body forum-post-excerpt-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(post.body || post.excerpt || "") }}
              />
              <div className="forum-post-foot forum-post-foot--split">
                <div className="forum-post-foot-left">
                  <span className="forum-author">@{post.author}</span>
                  <span className="forum-stat forum-post-time">发布于 {formatPostTime(post.createdAt)}</span>
                </div>
                <div className="forum-post-foot-right">
                  <span className="forum-stat">
                    <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                    {post.stats?.views ?? 0}
                  </span>
                  <span className="forum-stat">
                    <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                    {post.stats?.comments ?? 0}
                  </span>
                  <span className="forum-stat">
                    <img src={likeIcon} alt="点赞数" className="forum-stat-icon" />
                    {post.stats?.likes ?? 0}
                  </span>
                </div>
              </div>
            </button>
          ))}
      </section>
      <div className="recent-pager">
        <button
          type="button"
          className="recent-pager-btn"
          disabled={loading || page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          上一页
        </button>
        <span className="recent-pager-label">第 {page + 1} 页</span>
        <button
          type="button"
          className="recent-pager-btn"
          disabled={loading || !hasNext}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

const FORUM_CATEGORIES = ["全部", "热门", "技术", "生活", "灵感", "闲聊"];
const FORUM_TOPIC_TAGS = ["#学习打卡", "#效率工具", "#内容创作", "#Nooktalk设计", "#开发日志"];

function PostsBoard({ onBackHome, authToken, currentUser, onNeedLogin }) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [posts, setPosts] = useState([]);
  const [hotPosts, setHotPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(() =>
    typeof window !== "undefined" ? postsDetailIdFromPathname() : null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [likeSubmitting, setLikeSubmitting] = useState(false);
  const [commentLikeBusyId, setCommentLikeBusyId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(() =>
    typeof window !== "undefined" ? isPostsComposePathname() : false,
  );
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeContext, setComposeContext] = useState(() => {
    const st = typeof window !== "undefined" ? window.history.state || {} : {};
    return { from: st?.from || "posts", myPostsTab: st?.myPostsTab || "active", editPost: st?.editPost || null };
  });
  const [composeForm, setComposeForm] = useState({
    title: "",
    tag: "闲聊",
    topicsText: "",
    body: "",
  });
  const [composeTagOpen, setComposeTagOpen] = useState(false);
  const composeTagRef = useRef(null);
  const composeEditorHostRef = useRef(null);
  const composeEditorRef = useRef(null);
  const commentInputRef = useRef(null);
  const composeTagOptions = useMemo(
    () => FORUM_CATEGORIES.filter((x) => !["全部", "热门"].includes(x)),
    [],
  );

  useEffect(() => {
    if (!composeTagOpen) return;
    const onDocPointer = (ev) => {
      if (composeTagRef.current?.contains(ev.target)) return;
      setComposeTagOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer, true);
    return () => document.removeEventListener("mousedown", onDocPointer, true);
  }, [composeTagOpen]);

  useEffect(() => {
    if (!composeOpen) {
      setComposeTagOpen(false);
    }
  }, [composeOpen]);

  const silenced = Boolean(currentUser?.isSilenced);

  /** 按浏览量取前几条（与后端热帖榜一致）；用于接口失败时的兜底 */
  const topPostsByViews = useCallback((rows, n = 5) => {
    if (!Array.isArray(rows) || !rows.length) return [];
    return [...rows]
      .sort((a, b) => (Number(b?.stats?.views) || 0) - (Number(a?.stats?.views) || 0))
      .slice(0, n);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    let listItems = [];
    try {
      const q = new URLSearchParams();
      if (activeCategory) q.set("tag", activeCategory);
      const res = await fetch(`/api/posts?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "帖子加载失败");
      listItems = Array.isArray(data?.items) ? data.items : [];
      setPosts(listItems);
    } catch (err) {
      setPosts([]);
      setError(err instanceof Error ? err.message : "帖子加载失败");
    } finally {
      setLoading(false);
    }
    try {
      const resHot = await fetch("/api/posts/hot?limit=5");
      const hotData = await resHot.json().catch(() => ({}));
      if (resHot.ok && Array.isArray(hotData?.items) && hotData.items.length > 0) {
        setHotPosts(hotData.items);
      } else {
        setHotPosts(topPostsByViews(listItems, 5));
      }
    } catch {
      setHotPosts(topPostsByViews(listItems, 5));
    }
  }, [activeCategory, topPostsByViews]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const loadPostDetail = useCallback(
    async (postId, incrementView = true) => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const query = new URLSearchParams({ increment_view: String(incrementView) });
        const headers = {};
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        const res = await fetch(`/api/posts/${postId}?${query.toString()}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "帖子详情加载失败");
        setDetail(data);
      } catch (err) {
        setDetail(null);
        setDetailError(err instanceof Error ? err.message : "帖子详情加载失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [authToken],
  );

  const openPostDetail = useCallback(
    async (postId) => {
      setSelectedPostId(postId);
      setCommentEditorOpen(false);
      history.pushState({ view: "posts-detail", postId, from: "posts" }, "", postsDetailPathname(postId));
      await loadPostDetail(postId, true);
    },
    [loadPostDetail],
  );

  const closePostDetail = useCallback(() => {
    setSelectedPostId(null);
    const from = window.history.state?.from;
    const myPostsTab = window.history.state?.myPostsTab || "active";
    if (from === "my-posts") {
      history.pushState({ view: "my-posts", myPostsTab }, "", myPostsPathname());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (from === "recent") {
      history.pushState({ view: "recent" }, "", recentPathname());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (from === "profile") {
      history.pushState({ view: "profile" }, "", profilePathname());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (from === "profile-likes") {
      history.pushState({ view: "profile-likes" }, "", profileReceivedLikesPathname());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (from === "profile-comments") {
      history.pushState({ view: "profile-comments" }, "", profileReceivedCommentsPathname());
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      history.pushState({ view: "posts" }, "", postsPathname());
    }
    setDetail(null);
    setDetailError("");
    setCommentText("");
    setCommentEditorOpen(false);
  }, []);

  const onSubmitPost = useCallback(
    async (e) => {
      e.preventDefault();
      if (composeSubmitting) return;
      if (!authToken) {
        setComposeOpen(false);
        history.pushState({ view: "posts" }, "", postsPathname());
        onNeedLogin?.();
        return;
      }
      if (silenced) {
        window.alert("您已被禁言，暂时无法发帖与评论");
        return;
      }
      const title = composeForm.title.trim();
      const body = (composeEditorRef.current?.getMarkdown() || composeForm.body || "").trim();
      const topics = Array.from(
        new Set(
          composeForm.topicsText
            .split(/[\s,，]+/)
            .map((t) => t.trim().replace(/^#+/, ""))
            .filter(Boolean)
            .slice(0, 8),
        ),
      );
      if (title.length < 2 || body.length < 2) {
        setComposeError("标题和正文至少 2 个字符");
        return;
      }
      setComposeError("");
      setComposeSubmitting(true);
      try {
        const isEdit = Boolean(composeContext.editPost?.id);
        const res = await fetch(isEdit ? `/api/posts/${composeContext.editPost.id}` : "/api/posts", {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title,
            body,
            tag: composeForm.tag || "闲聊",
            topics,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || (isEdit ? "编辑失败" : "发帖失败"));
        setComposeOpen(false);
        if (composeContext.from === "my-posts") {
          history.pushState({ view: "my-posts", myPostsTab: composeContext.myPostsTab || "active" }, "", myPostsPathname());
          window.dispatchEvent(new PopStateEvent("popstate"));
        } else {
          history.pushState({ view: "posts" }, "", postsPathname());
        }
        setComposeContext({ from: "posts", myPostsTab: "active", editPost: null });
        setComposeForm({ title: "", tag: "闲聊", topicsText: "", body: "" });
        await loadPosts();
      } catch (err) {
        setComposeError(err instanceof Error ? err.message : "提交失败");
      } finally {
        setComposeSubmitting(false);
      }
    },
    [
      authToken,
      composeForm.body,
      composeForm.tag,
      composeForm.title,
      composeForm.topicsText,
      composeContext.editPost?.id,
      composeContext.from,
      composeSubmitting,
      loadPosts,
      onNeedLogin,
      silenced,
    ],
  );

  useEffect(() => {
    if (!composeOpen) return;
    if (!composeEditorHostRef.current) return;
    if (composeEditorRef.current) return;
    const hostEl = composeEditorHostRef.current;
    const editor = new Editor({
      el: hostEl,
      height: "420px",
      initialEditType: "wysiwyg",
      hideModeSwitch: true,
      initialValue: composeForm.body || "",
      placeholder: "在这里输入正文，所见即所得；发布时会自动保存为 Markdown。",
      usageStatistics: false,
      plugins: [[codeSyntaxHighlight, { highlighter: Prism }], createWysiwygCodeBlockPlugin()],
    });

    editor.on("change", () => {
      try {
        const next = editor.getMarkdown();
        setComposeForm((prev) => (prev.body === next ? prev : { ...prev, body: next }));
      } catch {
        // noop
      }
    });

    composeEditorRef.current = editor;
    return () => {
      try {
        editor.destroy();
      } catch {
        // noop
      }
      composeEditorRef.current = null;
    };
  }, [composeOpen]);

  useEffect(() => {
    const onPop = () => {
      const open = isPostsComposePathname();
      setComposeOpen(open);
      if (open) {
        const st = window.history.state || {};
        setComposeContext({
          from: st?.from || "posts",
          myPostsTab: st?.myPostsTab || "active",
          editPost: st?.editPost || null,
        });
      }
      const detailId = postsDetailIdFromPathname();
      setSelectedPostId(detailId);
      if (!detailId) {
        setDetail(null);
        setDetailError("");
        setCommentText("");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!composeOpen) return;
    const ep = composeContext.editPost;
    if (!ep) return;
    setComposeForm({
      title: ep.title || "",
      tag: ep.tag || "闲聊",
      topicsText: Array.isArray(ep.topics) ? ep.topics.map((t) => `#${t}`).join(" ") : "",
      body: ep.body || "",
    });
    if (composeEditorRef.current) composeEditorRef.current.setMarkdown(ep.body || "");
  }, [composeContext.editPost, composeOpen]);

  useEffect(() => {
    if (!selectedPostId) return;
    if (composeOpen) setComposeOpen(false);
    loadPostDetail(selectedPostId, false);
  }, [composeOpen, loadPostDetail, selectedPostId]);

  const onToggleLike = useCallback(async () => {
    if (!selectedPostId) return;
    if (!authToken) {
      onNeedLogin?.();
      return;
    }
    if (likeSubmitting) return;
    setLikeSubmitting(true);
    try {
      const liked = Boolean(detail?.likedByMe);
      const res = await fetch(`/api/posts/${selectedPostId}/like`, {
        method: liked ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "点赞操作失败");
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              likedByMe: !liked,
              item: {
                ...prev.item,
                stats: {
                  ...prev.item.stats,
                  likes: Number(data?.likes ?? prev.item.stats?.likes ?? 0),
                },
              },
            }
          : prev,
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPostId
            ? {
                ...p,
                stats: {
                  ...p.stats,
                  likes: Number(data?.likes ?? p.stats?.likes ?? 0),
                },
              }
            : p,
        ),
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "点赞操作失败");
    } finally {
      setLikeSubmitting(false);
    }
  }, [authToken, detail?.likedByMe, likeSubmitting, onNeedLogin, selectedPostId]);

  const onMarkdownBodyClick = useCallback(async (e) => {
    const copyBtn = e.target instanceof Element ? e.target.closest(".md-code-copy") : null;
    if (!copyBtn) return;
    const encoded = copyBtn.getAttribute("data-code") || "";
    const content = decodeURIComponent(encoded);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const ta = document.createElement("textarea");
        ta.value = content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      copyBtn.dataset.copied = "1";
      window.setTimeout(() => {
        delete copyBtn.dataset.copied;
      }, 1200);
    } catch {
      window.alert("复制失败，请手动复制");
    }
  }, []);

  const onSubmitComment = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedPostId) return;
      if (!authToken) {
        onNeedLogin?.();
        return;
      }
      if (commentSubmitting) return;
      if (silenced) {
        window.alert("您已被禁言，暂时无法发帖与评论");
        return;
      }
      const content = commentText.trim();
      if (!content) return;
      setCommentSubmitting(true);
      try {
        const res = await fetch(`/api/posts/${selectedPostId}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "评论失败");
        setCommentText("");
        setCommentEditorOpen(false);
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                comments: [...(prev.comments || []), data.comment],
                item: {
                  ...prev.item,
                  stats: {
                    ...prev.item.stats,
                    comments: Number(data?.comments ?? prev.item.stats?.comments ?? 0),
                  },
                },
              }
            : prev,
        );
        setPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPostId
              ? {
                  ...p,
                  stats: {
                    ...p.stats,
                    comments: Number(data?.comments ?? p.stats?.comments ?? 0),
                  },
                }
              : p,
          ),
        );
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "评论失败");
      } finally {
        setCommentSubmitting(false);
      }
    },
    [authToken, commentSubmitting, commentText, onNeedLogin, selectedPostId, silenced],
  );

  const onToggleCommentEditor = useCallback(() => {
    if (!authToken) {
      onNeedLogin?.();
      return;
    }
    if (silenced) {
      window.alert("您已被禁言，暂时无法发帖与评论");
      return;
    }
    if (detail?.item?.deleted) {
      window.alert("请先恢复帖子后再评论");
      return;
    }
    setCommentEditorOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          commentInputRef.current?.focus();
        });
      }
      return next;
    });
  }, [authToken, detail?.item?.deleted, onNeedLogin, silenced]);

  const onRestorePost = useCallback(async () => {
    if (!selectedPostId || !authToken) return;
    try {
      const res = await fetch(`/api/posts/${selectedPostId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "恢复失败");
      await loadPostDetail(selectedPostId, false);
      await loadPosts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "恢复失败");
    }
  }, [selectedPostId, authToken, loadPostDetail, loadPosts]);

  const onDeleteComment = useCallback(
    async (commentId) => {
      if (!selectedPostId || !authToken) return;
      if (!window.confirm("确定删除这条评论？")) return;
      try {
        const res = await fetch(`/api/posts/${selectedPostId}/comments/${commentId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "删除失败");
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                comments: (prev.comments || []).filter((c) => c.id !== commentId),
                item: prev.item
                  ? {
                      ...prev.item,
                      stats: {
                        ...prev.item.stats,
                        comments: Number(data?.comments ?? prev.item.stats?.comments ?? 0),
                      },
                    }
                  : prev.item,
              }
            : prev,
        );
        setPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPostId
              ? {
                  ...p,
                  stats: {
                    ...p.stats,
                    comments: Number(data?.comments ?? p.stats?.comments ?? 0),
                  },
                }
              : p,
          ),
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "删除失败");
      }
    },
    [selectedPostId, authToken],
  );

  const onToggleCommentLike = useCallback(
    async (commentId, likedByMe) => {
      if (!selectedPostId) return;
      if (!authToken) {
        onNeedLogin?.();
        return;
      }
      setCommentLikeBusyId(commentId);
      try {
        const method = likedByMe ? "DELETE" : "POST";
        const res = await fetch(`/api/posts/${selectedPostId}/comments/${commentId}/like`, {
          method,
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "操作失败");
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                comments: (prev.comments || []).map((c) =>
                  c.id === commentId ? { ...c, likedByMe: !likedByMe, likes: Number(data?.likes ?? c.likes) } : c,
                ),
              }
            : prev,
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "操作失败");
      } finally {
        setCommentLikeBusyId(null);
      }
    },
    [selectedPostId, authToken, onNeedLogin],
  );

  return (
    <div
      className={"forum-page" + (selectedPostId && !composeOpen ? " forum-page--detail" : "")}
      lang="zh-CN"
    >
      {!composeOpen && !selectedPostId ? (
        <>
          <div className="forum-hero card">
            <div>
              <p className="forum-kicker">POST SQUARE</p>
              <h1 className="forum-title">帖子广场</h1>
              <p className="forum-sub">
                {currentUser
                  ? `当前账号：${currentUser.username}（已登录）`
                  : "浏览公开帖子，登录后可发布内容。"}
              </p>
            </div>
            <button type="button" className="forum-back" onClick={onBackHome}>
              返回首页
            </button>
          </div>

          <div className="forum-toolbar card">
            <div className="forum-cats" role="tablist" aria-label="帖子分类">
              {FORUM_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"forum-cat" + (activeCategory === c ? " active" : "")}
                  aria-selected={activeCategory === c}
                  onClick={() => setActiveCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="forum-new"
              onClick={() => {
                if (!authToken) {
                  onNeedLogin?.();
                  return;
                }
                if (silenced) {
                  window.alert("您已被禁言，暂时无法发帖与评论");
                  return;
                }
                setComposeError("");
                setComposeContext({ from: "posts", myPostsTab: "active", editPost: null });
                setComposeOpen(true);
                history.pushState({ view: "posts-compose", from: "posts" }, "", postsComposePathname());
              }}
            >
              + 发布帖子
            </button>
          </div>
        </>
      ) : null}

      {selectedPostId ? (
        <div className="forum-detail-wrap">
          <div className="forum-detail card">
            <div className="forum-detail-scroll">
            {detailLoading ? <p className="forum-detail-loading">帖子详情加载中...</p> : null}
            {!detailLoading && detailError ? <p className="forum-detail-loading">加载失败：{detailError}</p> : null}
            {!detailLoading && detail?.item ? (
              <>
                <div className="forum-detail-topline">
                  <div className="forum-post-head">
                    <span className="forum-tag">{detail.item.tag}</span>
                    {detail.item.pinned ? <span className="forum-pinned">置顶</span> : null}
                  </div>
                  <button
                    type="button"
                    className="forum-side-compose-close"
                    onClick={closePostDetail}
                    aria-label="关闭帖子详情"
                  >
                    <img src={closeIcon} alt="" className="forum-side-compose-close-icon" />
                  </button>
                </div>
                {detail.item?.deleted ? (
                  <div className="forum-deleted-banner" role="status">
                    <p>
                      该帖已从公开列表中隐藏。作者或管理员可在此恢复；超过 30 天未恢复将由系统清理。
                    </p>
                    <button type="button" className="forum-btn-restore" onClick={onRestorePost}>
                      恢复帖子
                    </button>
                  </div>
                ) : null}
                <h2 className="forum-detail-title">{detail.item.title}</h2>
                {Array.isArray(detail.item.topics) && detail.item.topics.length > 0 ? (
                  <div className="forum-post-topics">
                    {detail.item.topics.map((t) => (
                      <span key={`d-topic-${t}`} className="forum-topic-chip">
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div
                  className="forum-detail-body markdown-body"
                  onClick={onMarkdownBodyClick}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.item.body) }}
                />
                <div className="forum-post-foot forum-detail-foot forum-post-foot--split">
                  <div className="forum-post-foot-left">
                    <span className="forum-author">@{detail.item.author}</span>
                    <span className="forum-stat forum-post-time">发布于 {formatPostTime(detail.item.createdAt)}</span>
                  </div>
                  <div className="forum-post-foot-right">
                    <span className="forum-stat">
                      <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                      {detail.item.stats?.views ?? 0}
                    </span>
                    <button type="button" className="forum-stat forum-stat-btn" onClick={onToggleCommentEditor}>
                      <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                      {detail.item.stats?.comments ?? 0}
                    </button>
                    <button
                      type="button"
                      className={"forum-stat forum-stat-btn forum-stat-like" + (detail.likedByMe ? " active" : "")}
                      onClick={onToggleLike}
                      disabled={likeSubmitting || Boolean(detail.item?.deleted)}
                    >
                      <Heart
                        size={14}
                        className="forum-stat-icon forum-stat-icon--like"
                        color={detail.likedByMe ? "#d73748" : "#6b7b74"}
                        fill={detail.likedByMe ? "#d73748" : "none"}
                        strokeWidth={2}
                      />
                      <span className="forum-stat-like-count">{detail.item.stats?.likes ?? 0}</span>
                    </button>
                  </div>
                </div>
                <div className="forum-comments">
                  <h3>评论（{detail.item.stats?.comments ?? 0}）</h3>
                  {commentEditorOpen ? (
                    <form className="forum-comment-form" onSubmit={onSubmitComment}>
                      <textarea
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={
                          silenced ? "禁言期间不可评论"
                          : detail.item?.deleted ? "恢复帖子后可评论"
                          : authToken
                            ? "写下你的评论..."
                            : "登录后可评论"
                        }
                        disabled={commentSubmitting || silenced || Boolean(detail.item?.deleted)}
                        rows={3}
                      />
                      <div className="forum-comment-actions">
                        <button type="button" className="forum-comment-cancel" onClick={() => setCommentEditorOpen(false)}>
                          取消
                        </button>
                        <button type="submit" disabled={commentSubmitting}>
                          {commentSubmitting ? "发布中..." : "发布评论"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  <div className="forum-comment-list">
                    {(detail.comments || []).length ? (
                      detail.comments.map((c) => (
                        <article key={c.id} className="forum-comment-item">
                          <div className="forum-comment-head">
                            <p className="forum-comment-author">@{c.author}</p>
                            <div className="forum-comment-actions-inline">
                              <button
                                type="button"
                                className={"forum-comment-like" + (c.likedByMe ? " active" : "")}
                                disabled={commentLikeBusyId === c.id || Boolean(detail.item?.deleted)}
                                onClick={() => onToggleCommentLike(c.id, Boolean(c.likedByMe))}
                                aria-label={c.likedByMe ? "取消赞" : "点赞"}
                              >
                                <Heart
                                  size={12}
                                  className="forum-stat-icon forum-stat-icon--like"
                                  color={c.likedByMe ? "#d73748" : "#6b7b74"}
                                  fill={c.likedByMe ? "#d73748" : "none"}
                                  strokeWidth={2}
                                />
                                <span className="forum-comment-like-n">{c.likes ?? 0}</span>
                              </button>
                              {(currentUser?.id === c.authorId || currentUser?.isSuperuser) &&
                              !detail.item?.deleted ? (
                                <button
                                  type="button"
                                  className="forum-comment-del"
                                  onClick={() => onDeleteComment(c.id)}
                                >
                                  删除
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <p className="forum-comment-content">{c.content}</p>
                          <p className="forum-comment-time">发布于 {formatPostTime(c.createdAt)}</p>
                        </article>
                      ))
                    ) : (
                      <p className="forum-comment-empty">还没有评论，来做第一个评论的人吧。</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
            </div>
          </div>
        </div>
      ) : composeOpen ? (
        <section className="forum-compose-full card">
          <div className="forum-side-compose-head">
            <h3>{composeContext.editPost ? "编辑帖子" : "发布帖子"}</h3>
            <button
              type="button"
              className="forum-side-compose-close"
              onClick={() => {
                setComposeOpen(false);
                if (composeContext.from === "my-posts") {
                  history.pushState(
                    { view: "my-posts", myPostsTab: composeContext.myPostsTab || "active" },
                    "",
                    myPostsPathname(),
                  );
                  window.dispatchEvent(new PopStateEvent("popstate"));
                } else {
                  history.pushState({ view: "posts" }, "", postsPathname());
                }
                setComposeContext({ from: "posts", myPostsTab: "active", editPost: null });
              }}
              disabled={composeSubmitting}
              aria-label="关闭发布面板"
            >
              <img src={closeIcon} alt="" className="forum-side-compose-close-icon" />
            </button>
          </div>
          <form className="auth-form forum-compose-form" onSubmit={onSubmitPost}>
            <label className="auth-field">
              <span>标题</span>
              <input
                type="text"
                value={composeForm.title}
                onChange={(e) =>
                  setComposeForm((prev) => ({ ...prev, title: e.target.value }))
                }
                disabled={composeSubmitting}
                placeholder="输入帖子标题"
              />
            </label>
            <label className="auth-field">
              <span>分类</span>
              <div
                className={
                  "forum-compose-selectbox" +
                  (composeTagOpen && !composeSubmitting ? " is-open" : "") +
                  (composeSubmitting ? " disabled" : "")
                }
                ref={composeTagRef}
              >
                <button
                  type="button"
                  className="forum-compose-select-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={composeTagOpen && !composeSubmitting}
                  aria-label="选择帖子分类"
                  disabled={composeSubmitting}
                  onClick={() => setComposeTagOpen((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setComposeTagOpen(false);
                      return;
                    }
                    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setComposeTagOpen(true);
                    }
                  }}
                >
                  <span>{composeForm.tag}</span>
                  <span className="forum-compose-select-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
                {composeTagOpen && !composeSubmitting ? (
                  <ul className="forum-compose-select-menu" role="listbox" aria-label="帖子分类选项">
                    {composeTagOptions.map((x) => (
                      <li key={x} role="option" aria-selected={composeForm.tag === x}>
                        <button
                          type="button"
                          className={"forum-compose-select-item" + (composeForm.tag === x ? " is-selected" : "")}
                          onClick={() => {
                            setComposeForm((prev) => ({ ...prev, tag: x }));
                            setComposeTagOpen(false);
                          }}
                        >
                          {x}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </label>
            <label className="auth-field">
              <span>话题标签（可选）</span>
              <input
                type="text"
                value={composeForm.topicsText}
                onChange={(e) =>
                  setComposeForm((prev) => ({ ...prev, topicsText: e.target.value }))
                }
                disabled={composeSubmitting}
                placeholder="#学习打卡 #效率工具（空格分隔，最多 8 个）"
              />
            </label>
            <div className="auth-field forum-compose-field-rich" aria-labelledby="compose-editor-label">
              <span id="compose-editor-label">正文（Markdown）</span>
              <div
                ref={composeEditorHostRef}
                className={"forum-compose-editor-host" + (composeSubmitting ? " disabled" : "")}
              />
            </div>
            {composeError ? <p className="auth-error">{composeError}</p> : null}
            <div className="auth-actions forum-compose-actions">
              <button type="submit" className="auth-submit" disabled={composeSubmitting}>
                {composeSubmitting ? "提交中..." : composeContext.editPost ? "保存修改" : "发布帖子"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="forum-body">
          <section className="forum-feed">
            {loading ? <article className="forum-post card">帖子加载中...</article> : null}
            {!loading && error ? <article className="forum-post card">加载失败：{error}</article> : null}
            {!loading && !error && posts.length === 0 ? (
              <article className="forum-post card">当前分类还没有帖子，发一条试试吧。</article>
            ) : null}
            {!loading &&
              !error &&
              posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="forum-post forum-post-btn card"
                  onClick={() => openPostDetail(post.id)}
                >
                  <div className="forum-post-title-row">
                    <h3 className="forum-post-title">{post.title}</h3>
                    <div className="forum-post-tags-inline">
                      {Array.isArray(post.topics)
                        ? post.topics.map((t) => (
                            <span key={`${post.id}-topic-${t}`} className="forum-topic-chip">
                              #{t}
                            </span>
                          ))
                        : null}
                      {post.tag ? <span className="forum-tag">{post.tag}</span> : null}
                      {post.pinned ? <span className="forum-pinned">置顶</span> : null}
                    </div>
                  </div>
                  <div
                    className="markdown-body forum-post-excerpt-md"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(post.body || post.excerpt || "") }}
                  />
                  <div className="forum-post-foot forum-post-foot--split">
                    <div className="forum-post-foot-left">
                      <span className="forum-author">@{post.author}</span>
                      <span className="forum-stat forum-post-time">发布于 {formatPostTime(post.createdAt)}</span>
                    </div>
                    <div className="forum-post-foot-right">
                      <span className="forum-stat">
                        <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                        {post.stats?.views ?? 0}
                      </span>
                      <span className="forum-stat">
                        <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                        {post.stats?.comments ?? 0}
                      </span>
                      <span className="forum-stat">
                        <img src={likeIcon} alt="点赞数" className="forum-stat-icon" />
                        {post.stats?.likes ?? 0}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </section>

          <aside className="forum-side">
            <div className="forum-side-card card">
              <h3>热帖榜</h3>
              {hotPosts.length ? (
                <ol className="forum-hot-board">
                  {hotPosts.map((p) => (
                    <li key={`hot-${p.id}`}>
                      <button
                        type="button"
                        className="forum-hot-board-link"
                        onClick={() => openPostDetail(p.id)}
                      >
                        {p.title}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="forum-hot-board-empty">暂无可展示的热帖</p>
              )}
            </div>
            <div className="forum-side-card card">
              <h3>推荐话题</h3>
              <div className="forum-topics">
                {FORUM_TOPIC_TAGS.map((t) => (
                  <button key={t} type="button">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
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
      return;
    }
    if (page === "recent") {
      if (activePage === "recent") return;
      history.pushState({ view: "recent" }, "", recentPathname());
      setActivePage("recent");
      return;
    }
    if (page === "my-posts") {
      if (activePage === "my-posts") return;
      history.pushState({ view: "my-posts" }, "", myPostsPathname());
      setActivePage("my-posts");
      return;
    }
    if (page === "profile") {
      if (activePage === "profile") return;
      history.pushState({ view: "profile" }, "", profilePathname());
      setActivePage("profile");
      return;
    }
    if (page === "admin") {
      if (activePage === "admin") return;
      history.pushState({ view: "admin" }, "", adminPathname());
      setActivePage("admin");
      return;
    }
    if (page === "posts") {
      if (activePage === "posts") return;
      history.pushState({ view: "posts" }, "", postsPathname());
      setActivePage("posts");
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
  const [authToken, setAuthToken] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("nooktalk_token") || "" : "",
  );
  const [currentUser, setCurrentUser] = useState(null);
  const isLoggedIn = Boolean(currentUser && authToken);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error("me_failed");
        const data = await res.json();
        if (!cancelled && data?.user) setCurrentUser(data.user);
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthToken("");
          window.localStorage.removeItem("nooktalk_token");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const persistAuth = useCallback((token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    window.localStorage.setItem("nooktalk_token", token);
  }, []);

  const [authModalMode, setAuthModalMode] = useState(null); // "login" | "register" | null
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ account: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const closeAuthModal = useCallback(() => {
    if (authSubmitting) return;
    setAuthModalMode(null);
    setAuthError("");
  }, [authSubmitting]);

  const clearAuth = useCallback(() => {
    setCurrentUser(null);
    setAuthToken("");
    window.localStorage.removeItem("nooktalk_token");
  }, []);

  const openAuthModal = useCallback((mode) => {
    setAuthError("");
    setAuthModalMode(mode);
  }, []);

  const doLogin = useCallback(async (account, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "登录失败");
    persistAuth(data.access_token, data.user);
  }, [persistAuth]);

  const doRegister = useCallback(async (username, email, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "注册失败");
    persistAuth(data.access_token, data.user);
  }, [persistAuth]);

  const doLogout = useCallback(async () => {
    if (!authToken) {
      clearAuth();
      return;
    }
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } finally {
      clearAuth();
    }
  }, [authToken, clearAuth]);

  const submitLogin = useCallback(async (e) => {
    e.preventDefault();
    if (authSubmitting) return;
    const account = loginForm.account.trim();
    const password = loginForm.password;
    if (!account || !password) {
      setAuthError("请填写账号与密码");
      return;
    }
    setAuthError("");
    setAuthSubmitting(true);
    try {
      await doLogin(account, password);
      setAuthModalMode(null);
      setLoginForm({ account: "", password: "" });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setAuthSubmitting(false);
    }
  }, [authSubmitting, doLogin, loginForm.account, loginForm.password]);

  const submitRegister = useCallback(async (e) => {
    e.preventDefault();
    if (authSubmitting) return;
    const username = registerForm.username.trim();
    const email = registerForm.email.trim();
    const password = registerForm.password;
    const confirm = registerForm.confirmPassword;
    if (!username || !email || !password || !confirm) {
      setAuthError("请完整填写注册信息");
      return;
    }
    if (password.length < 6) {
      setAuthError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setAuthError("两次输入的密码不一致");
      return;
    }
    setAuthError("");
    setAuthSubmitting(true);
    try {
      await doRegister(username, email, password);
      setAuthModalMode(null);
      setRegisterForm({ username: "", email: "", password: "", confirmPassword: "" });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setAuthSubmitting(false);
    }
  }, [authSubmitting, doRegister, registerForm]);

  const handlePrimaryCard = useCallback(() => {
    if (isLoggedIn) {
      goToPage("profile");
      return;
    }
    openAuthModal("login");
  }, [goToPage, isLoggedIn, openAuthModal]);

  const handleSecondaryCard = useCallback(async () => {
    if (isLoggedIn) {
      if (currentUser?.isSuperuser) {
        goToPage("admin");
        return;
      }
      goToPage("my-posts");
      return;
    }
    openAuthModal("register");
  }, [currentUser?.isSuperuser, goToPage, isLoggedIn, openAuthModal]);

  const userGreetingPool = useMemo(() => {
    if (!currentUser) return [];
    return [
      "欢迎回来，今天也来记录一点好想法吧。",
      "你的创作空间已经准备好，随时可以开写。",
      "愿你今天的灵感和好天气一样稳定在线。",
      "很高兴又见到你，去看看社区里有哪些新讨论。",
      "你的下一条内容可能正好打动某个路过的人。",
      "慢慢来，把今天想说的话留在 Nooktalk。",
    ];
  }, [currentUser]);
  const [userGreetingIndex, setUserGreetingIndex] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || userGreetingPool.length <= 1) return undefined;
    const timer = setInterval(() => {
      setUserGreetingIndex((prev) => pickNextGreetingIndex(userGreetingPool.length, prev));
    }, 9000);
    return () => clearInterval(timer);
  }, [isLoggedIn, userGreetingPool]);

  useEffect(() => {
    setUserGreetingIndex(0);
  }, [isLoggedIn]);

  const greetingMainLine = isLoggedIn
    ? (userGreetingPool[userGreetingIndex] ?? "欢迎回来。")
    : "我是 隅友，很高兴在 Nooktalk 遇见你。";
  const scheduleScopeKey = isLoggedIn ? `user:${currentUser.id}` : "guest";

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
                    : item.id === "recent"
                      ? recentPathname()
                    : "#";
              return (
                <li key={item.id}>
                  <a
                    className={
                      "nav-item" + (item.id === activePage ? " active" : "")
                    }
                    href={href}
                    onClick={(e) => {
                      if (item.id === "home" || item.id === "schedule" || item.id === "recent") {
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
          <div className="subpage-with-back">
            <div className="subpage-main">
              <div className="subpage-back-inside">
                <button type="button" className="forum-back" onClick={() => goToPage("home")}>
                  返回首页
                </button>
              </div>
              <ScheduleCalendar scheduleScopeKey={scheduleScopeKey} authToken={authToken} />
            </div>
          </div>
        </div>
      ) : activePage === "weather" ? (
        <div className="col-center col-center--fill col-center--weather">
          <div className="subpage-with-back">
            <div className="subpage-main">
              <div className="subpage-back-inside">
                <button type="button" className="forum-back" onClick={() => goToPage("home")}>
                  返回首页
                </button>
              </div>
              <WeatherWeek />
            </div>
          </div>
        </div>
      ) : activePage === "time" ? (
        <div className="col-center col-center--fill col-center--weather col-center--time">
          <div className="subpage-with-back">
            <div className="subpage-main">
              <div className="subpage-back-inside">
                <button type="button" className="forum-back" onClick={() => goToPage("home")}>
                  返回首页
                </button>
              </div>
              <TimeTools />
            </div>
          </div>
        </div>
      ) : activePage === "music" ? (
        <div className="col-center col-center--fill col-center--weather col-center--music">
          <div className="subpage-with-back">
            <div className="subpage-main">
              <div className="subpage-back-inside">
                <button type="button" className="forum-back" onClick={() => goToPage("home")}>
                  返回首页
                </button>
              </div>
              <MusicPlayer />
            </div>
          </div>
        </div>
      ) : activePage === "recent" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <RecentPostsBoard
            onBackHome={() => goToPage("home")}
            onOpenPost={(postId) => {
              history.pushState({ view: "posts-detail", postId, from: "recent" }, "", postsDetailPathname(postId));
              setActivePage("posts");
            }}
          />
        </div>
      ) : activePage === "admin" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <AdminDashboard
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
            onBackHome={() => goToPage("home")}
          />
        </div>
      ) : activePage === "profile" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <ProfileCenterBoard
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
            onBackHome={() => goToPage("home")}
            onOpenMyPosts={(tab) => {
              const myPostsTab = tab === "deleted" ? "deleted" : "active";
              history.pushState({ view: "my-posts", myPostsTab }, "", myPostsPathname());
              setActivePage("my-posts");
            }}
            onOpenReceivedLikes={() => {
              history.pushState({ view: "profile-likes" }, "", profileReceivedLikesPathname());
              setActivePage("profile-likes");
            }}
            onOpenReceivedComments={() => {
              history.pushState({ view: "profile-comments" }, "", profileReceivedCommentsPathname());
              setActivePage("profile-comments");
            }}
            onLogout={doLogout}
            onOpenPost={(postId) => {
              history.pushState({ view: "posts-detail", postId, from: "profile" }, "", postsDetailPathname(postId));
              setActivePage("posts");
            }}
            onUserUpdated={(u) => {
              if (u && typeof u === "object") setCurrentUser(u);
            }}
          />
        </div>
      ) : activePage === "profile-likes" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <ProfileEngagementBoard
            kind="likes"
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
            onBackHome={() => goToPage("home")}
            onBackProfile={() => {
              history.pushState({ view: "profile" }, "", profilePathname());
              setActivePage("profile");
            }}
            onOpenPost={(postId) => {
              history.pushState(
                { view: "posts-detail", postId, from: "profile-likes" },
                "",
                postsDetailPathname(postId),
              );
              setActivePage("posts");
            }}
          />
        </div>
      ) : activePage === "profile-comments" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <ProfileEngagementBoard
            kind="comments"
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
            onBackHome={() => goToPage("home")}
            onBackProfile={() => {
              history.pushState({ view: "profile" }, "", profilePathname());
              setActivePage("profile");
            }}
            onOpenPost={(postId) => {
              history.pushState(
                { view: "posts-detail", postId, from: "profile-comments" },
                "",
                postsDetailPathname(postId),
              );
              setActivePage("posts");
            }}
          />
        </div>
      ) : activePage === "my-posts" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <MyPostsBoard
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
            onBackHome={() => goToPage("home")}
            onOpenPost={(postId) => {
              const st = window.history.state || {};
              history.pushState(
                { view: "posts-detail", postId, from: "my-posts", myPostsTab: st?.myPostsTab || "active" },
                "",
                postsDetailPathname(postId),
              );
              setActivePage("posts");
            }}
            onEditPost={(post, myPostsTab) => {
              history.pushState(
                { view: "posts-compose", from: "my-posts", myPostsTab: myPostsTab || "active", editPost: post },
                "",
                postsComposePathname(),
              );
              setActivePage("posts");
            }}
          />
        </div>
      ) : activePage === "posts" ? (
        <div className="col-center col-center--fill col-center--weather col-center--posts">
          <PostsBoard
            onBackHome={() => goToPage("home")}
            authToken={authToken}
            currentUser={currentUser}
            onNeedLogin={() => openAuthModal("login")}
          />
        </div>
      ) : (
        <>
          <div className="col-center">
            <button
              type="button"
              className="card polaroid-row polaroid-row--go"
              onClick={() => goToPage("posts")}
              aria-label="进入帖子界面"
            >
              <div className="polaroid-inner" aria-label="欢迎拼贴图">
                {POLAROIDS.map((p, i) => {
                  const guideChars = ["帖", "子", "广", "场"];
                  return (
                    <div key={i} className="polaroid">
                      <div className="polaroid-blob" style={{ background: p.bg }}>
                        <span className="polaroid-guide-char">{guideChars[i] || "帖"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>

            <div className="card greeting-block">
              <div className="greeting-avatar" aria-hidden>
                {isLoggedIn ? (
                  <img src={currentUser?.avatarUrl || avatarFromUsername(currentUser?.username)} alt="" />
                ) : (
                  "🪴"
                )}
              </div>
              <p className="greeting-time">
                {greetLabel} · {weekday}
              </p>
              <p className="greeting-line">
                {isLoggedIn ? (
                  <>
                    <strong>{currentUser.username}</strong>，{greetingMainLine}
                  </>
                ) : (
                  <>
                    <strong>隅友</strong>，很高兴在 Nooktalk 遇见你。
                  </>
                )}
              </p>
              <div className="auth-quick-row" aria-label="账号快捷入口（占位）">
                <button type="button" className="auth-quick-card" onClick={handlePrimaryCard}>
                  {isLoggedIn ? "个人中心" : "登录"}
                </button>
                <button type="button" className="auth-quick-card" onClick={handleSecondaryCard}>
                  {isLoggedIn ? (currentUser?.isSuperuser ? "管理后台" : "作品中心") : "注册"}
                </button>
              </div>
            </div>

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

      {authModalMode ? (
        <div
          className="auth-modal-mask"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAuthModal();
          }}
        >
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-label={authModalMode === "login" ? "登录窗口" : "注册窗口"}
          >
            <div className="auth-modal-head">
              <h3>{authModalMode === "login" ? "登录 Nooktalk" : "注册 Nooktalk"}</h3>
              <button
                type="button"
                className="auth-modal-close"
                onClick={closeAuthModal}
                disabled={authSubmitting}
                aria-label="关闭弹窗"
              >
                ×
              </button>
            </div>

            {authModalMode === "login" ? (
              <form className="auth-form" onSubmit={submitLogin}>
                <label className="auth-field">
                  <span>账号（用户名或邮箱）</span>
                  <input
                    type="text"
                    value={loginForm.account}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, account: e.target.value }))
                    }
                    autoFocus
                    disabled={authSubmitting}
                    placeholder="请输入用户名或邮箱"
                  />
                </label>
                <label className="auth-field">
                  <span>密码</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    disabled={authSubmitting}
                    placeholder="请输入密码"
                  />
                </label>
                {authError ? <p className="auth-error">{authError}</p> : null}
                <div className="auth-actions">
                  <button type="submit" className="auth-submit" disabled={authSubmitting}>
                    {authSubmitting ? "登录中..." : "登录"}
                  </button>
                  <button
                    type="button"
                    className="auth-recover"
                    disabled={authSubmitting}
                    onClick={() =>
                      window.alert("找回密码（占位）：后续会接邮箱验证码/重置密码流程。")
                    }
                  >
                    忘记密码？找回密码
                  </button>
                  <button
                    type="button"
                    className="auth-switch"
                    disabled={authSubmitting}
                    onClick={() => {
                      setAuthError("");
                      setAuthModalMode("register");
                    }}
                  >
                    没有账号？去注册
                  </button>
                </div>
              </form>
            ) : (
              <form className="auth-form" onSubmit={submitRegister}>
                <label className="auth-field">
                  <span>用户名</span>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    autoFocus
                    disabled={authSubmitting}
                    placeholder="2-32 位用户名"
                  />
                </label>
                <label className="auth-field">
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    disabled={authSubmitting}
                    placeholder="请输入邮箱"
                  />
                </label>
                <label className="auth-field">
                  <span>密码</span>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    disabled={authSubmitting}
                    placeholder="至少 6 位"
                  />
                </label>
                <label className="auth-field">
                  <span>确认密码</span>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    disabled={authSubmitting}
                    placeholder="请再次输入密码"
                  />
                </label>
                {authError ? <p className="auth-error">{authError}</p> : null}
                <div className="auth-actions">
                  <button type="submit" className="auth-submit" disabled={authSubmitting}>
                    {authSubmitting ? "注册中..." : "注册并登录"}
                  </button>
                  <button
                    type="button"
                    className="auth-switch"
                    disabled={authSubmitting}
                    onClick={() => {
                      setAuthError("");
                      setAuthModalMode("login");
                    }}
                  >
                    已有账号？去登录
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
