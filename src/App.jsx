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
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
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

function postsComposePathname() {
  return new URL("posts/new", `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
}

function isPostsComposePathname(pathname = window.location.pathname) {
  return pathname === postsComposePathname();
}

function postsDetailPathname(postId) {
  return new URL(`posts/${postId}`, `${window.location.origin}${import.meta.env.BASE_URL}`).pathname;
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

function renderMarkdown(mdText) {
  let normalized = String(mdText || "");
  // Some WYSIWYG-originated content stores escaped markdown literals (\n, \#, \*\*...).
  // Normalize those escapes so detail view can render markdown as expected.
  if (!normalized.includes("\n") && normalized.includes("\\n")) {
    normalized = normalized.replace(/\\n/g, "\n");
  }
  if (/\\[`*_#[\]()>-]/.test(normalized)) {
    normalized = normalized.replace(/\\([`*_#[\]()>-])/g, "$1");
  }
  const raw = marked.parse(normalized, { gfm: true, breaks: true });
  return DOMPurify.sanitize(raw);
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

const FORUM_CATEGORIES = ["全部", "热门", "技术", "生活", "灵感", "闲聊"];
const FORUM_TOPIC_TAGS = ["#学习打卡", "#效率工具", "#内容创作", "#Nooktalk设计", "#开发日志"];

function PostsBoard({ onBackHome, authToken, currentUser, onNeedLogin }) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [posts, setPosts] = useState([]);
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
  const [composeOpen, setComposeOpen] = useState(() =>
    typeof window !== "undefined" ? isPostsComposePathname() : false,
  );
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeForm, setComposeForm] = useState({
    title: "",
    tag: "闲聊",
    topicsText: "",
    body: "",
  });
  const composeEditorHostRef = useRef(null);
  const composeEditorRef = useRef(null);
  const commentInputRef = useRef(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (activeCategory) q.set("tag", activeCategory);
      const res = await fetch(`/api/posts?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "帖子加载失败");
      setPosts(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setPosts([]);
      setError(err instanceof Error ? err.message : "帖子加载失败");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

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
      history.pushState({ view: "posts-detail", postId }, "", postsDetailPathname(postId));
      await loadPostDetail(postId, true);
    },
    [loadPostDetail],
  );

  const closePostDetail = useCallback(() => {
    setSelectedPostId(null);
    history.pushState({ view: "posts" }, "", postsPathname());
    setDetail(null);
    setDetailError("");
    setCommentText("");
    setCommentEditorOpen(false);
  }, []);

  const hotPosts = useMemo(
    () =>
      [...posts]
        .sort(
          (a, b) =>
            b.stats.comments * 3 +
            b.stats.likes * 2 +
            b.stats.views -
            (a.stats.comments * 3 + a.stats.likes * 2 + a.stats.views),
        )
        .slice(0, 4),
    [posts],
  );

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
        const res = await fetch("/api/posts", {
          method: "POST",
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
        if (!res.ok) throw new Error(data?.detail || "发帖失败");
        setComposeOpen(false);
        history.pushState({ view: "posts" }, "", postsPathname());
        setComposeForm({ title: "", tag: "闲聊", topicsText: "", body: "" });
        await loadPosts();
      } catch (err) {
        setComposeError(err instanceof Error ? err.message : "发帖失败");
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
      composeSubmitting,
      loadPosts,
      onNeedLogin,
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
      setComposeOpen(isPostsComposePathname());
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
                  likes: Number(data?.likes ?? prev.item.stats.likes),
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
                  likes: Number(data?.likes ?? p.stats.likes),
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

  const onSubmitComment = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedPostId) return;
      if (!authToken) {
        onNeedLogin?.();
        return;
      }
      if (commentSubmitting) return;
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
                    comments: Number(data?.comments ?? prev.item.stats.comments),
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
                    comments: Number(data?.comments ?? p.stats.comments),
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
    [authToken, commentSubmitting, commentText, onNeedLogin, selectedPostId],
  );

  const onToggleCommentEditor = useCallback(() => {
    if (!authToken) {
      onNeedLogin?.();
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
  }, [authToken, onNeedLogin]);

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
                setComposeError("");
                setComposeOpen(true);
                history.pushState({ view: "posts-compose" }, "", postsComposePathname());
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
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.item.body) }}
                />
                <div className="forum-post-foot forum-detail-foot">
                  <span className="forum-author">@{detail.item.author}</span>
                  <span className="forum-stat">
                    <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                    {detail.item.stats.views}
                  </span>
                  <button type="button" className="forum-stat forum-stat-btn" onClick={onToggleCommentEditor}>
                    <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                    {detail.item.stats.comments}
                  </button>
                  <button
                    type="button"
                    className={"forum-stat forum-stat-btn forum-stat-like" + (detail.likedByMe ? " active" : "")}
                    onClick={onToggleLike}
                    disabled={likeSubmitting}
                  >
                    <Heart
                      size={14}
                      className="forum-stat-icon forum-stat-icon--like"
                      color={detail.likedByMe ? "#d73748" : "#6b7b74"}
                      fill={detail.likedByMe ? "#d73748" : "none"}
                      strokeWidth={2}
                    />
                    <span className="forum-stat-like-count">{detail.item.stats.likes}</span>
                  </button>
                </div>
                <div className="forum-comments">
                  <h3>评论（{detail.item.stats.comments}）</h3>
                  {commentEditorOpen ? (
                    <form className="forum-comment-form" onSubmit={onSubmitComment}>
                      <textarea
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={authToken ? "写下你的评论..." : "登录后可评论"}
                        disabled={commentSubmitting}
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
                          <p className="forum-comment-author">@{c.author}</p>
                          <p className="forum-comment-content">{c.content}</p>
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
            <h3>发布帖子</h3>
            <button
              type="button"
              className="forum-side-compose-close"
              onClick={() => {
                setComposeOpen(false);
                history.pushState({ view: "posts" }, "", postsPathname());
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
              <select
                className="forum-compose-select"
                value={composeForm.tag}
                onChange={(e) =>
                  setComposeForm((prev) => ({ ...prev, tag: e.target.value }))
                }
                disabled={composeSubmitting}
              >
                {FORUM_CATEGORIES.filter((x) => !["全部", "热门"].includes(x)).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
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
            <label className="auth-field">
              <span>正文（Markdown）</span>
              <div
                ref={composeEditorHostRef}
                className={"forum-compose-editor-host" + (composeSubmitting ? " disabled" : "")}
              />
            </label>
            {composeError ? <p className="auth-error">{composeError}</p> : null}
            <div className="auth-actions forum-compose-actions">
              <button type="submit" className="auth-submit" disabled={composeSubmitting}>
                {composeSubmitting ? "发布中..." : "发布帖子"}
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
                  <div className="forum-post-head">
                    <span className="forum-tag">{post.tag}</span>
                    {post.pinned ? <span className="forum-pinned">置顶</span> : null}
                  </div>
                  <h3 className="forum-post-title">{post.title}</h3>
                  {Array.isArray(post.topics) && post.topics.length > 0 ? (
                    <div className="forum-post-topics">
                      {post.topics.map((t) => (
                        <span key={`${post.id}-topic-${t}`} className="forum-topic-chip">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="forum-post-excerpt">{post.excerpt}</p>
                  <div className="forum-post-foot">
                    <span className="forum-author">@{post.author}</span>
                    <span className="forum-stat">
                      <img src={previewOpenIcon} alt="浏览量" className="forum-stat-icon" />
                      {post.stats.views}
                    </span>
                    <span className="forum-stat">
                      <img src={commentIcon} alt="评论数" className="forum-stat-icon" />
                      {post.stats.comments}
                    </span>
                    <span className="forum-stat">
                      <img src={likeIcon} alt="点赞数" className="forum-stat-icon" />
                      {post.stats.likes}
                    </span>
                  </div>
                </button>
              ))}
          </section>

          <aside className="forum-side">
            <div className="forum-side-card card">
              <h3>今日热帖榜</h3>
              <ol>
                {hotPosts.map((p) => (
                  <li key={`hot-${p.id}`}>{p.title}</li>
                ))}
              </ol>
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

  const handlePrimaryCard = useCallback(async () => {
    if (isLoggedIn) {
      const ok = window.confirm("个人中心（占位）\n\n点击“确定”将退出登录，方便你继续测试。");
      if (ok) {
        await doLogout();
      }
      return;
    }
    openAuthModal("login");
  }, [doLogout, isLoggedIn, openAuthModal]);

  const handleSecondaryCard = useCallback(async () => {
    if (isLoggedIn) {
      window.alert("作品中心（占位）：后续会接入我的帖子、草稿与数据统计。");
      return;
    }
    openAuthModal("register");
  }, [isLoggedIn, openAuthModal]);

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
          <ScheduleCalendar scheduleScopeKey={scheduleScopeKey} authToken={authToken} />
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
                    <div
                      className="polaroid-blob"
                      style={{ background: p.bg }}
                    >
                      <span className="polaroid-guide-char">{guideChars[i] || "帖"}</span>
                    </div>
                  </div>
                )})}
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
                  {isLoggedIn ? "作品中心" : "注册"}
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
