import { useCallback, useEffect, useState } from "react";
import { avatarFromUsername, fileToResizedJpegDataUrl, formatPostTime, normalizeApiError } from "../../forum/utils.js";

export function MobileProfilePage({
  authToken,
  currentUser,
  onNeedLogin,
  onLogout,
  onOpenMyPosts,
  onOpenEngagement,
  onOpenPost,
  onUserUpdated,
  subView,
}) {
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState([]);
  const [engLoading, setEngLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/posts/mine?include_deleted=true&limit=200", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
      const mine = Array.isArray(data?.items) ? data.items : [];
      const next = mine.reduce(
        (acc, p) => ({
          postCount: acc.postCount + 1,
          activePostCount: acc.activePostCount + (p.deleted ? 0 : 1),
          totalViews: acc.totalViews + Number(p.stats?.views || 0),
          totalLikes: acc.totalLikes + Number(p.stats?.likes || 0),
        }),
        { postCount: 0, activePostCount: 0, totalViews: 0, totalLikes: 0 },
      );
      setSummary(next);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const loadNotifications = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch("/api/notifications?limit=40", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setNotifications(res.ok && Array.isArray(data?.items) ? data.items : []);
    } catch {
      setNotifications([]);
    }
  }, [authToken]);

  const loadEngagement = useCallback(async () => {
    if (!authToken || !subView) return;
    setEngLoading(true);
    try {
      const path =
        subView === "profile-likes" ? "/api/posts/mine/received-likes" : "/api/posts/mine/received-comments";
      const res = await fetch(`${path}?limit=80`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
      setEngagement(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setEngagement([]);
    } finally {
      setEngLoading(false);
    }
  }, [authToken, subView]);

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    if (subView) {
      loadEngagement();
    } else {
      loadSummary();
      loadNotifications();
    }
  }, [authToken, subView, loadSummary, loadNotifications, loadEngagement]);

  const saveAvatar = async (file) => {
    if (!file || !authToken) return;
    try {
      const dataUrl = await fileToResizedJpegDataUrl(file);
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "保存失败"));
      onUserUpdated?.(data?.user);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "保存失败");
    }
  };

  if (!authToken) {
    return (
      <div className="m-card">
        <p className="m-muted">登录后使用个人中心</p>
        <button type="button" className="m-btn m-btn--primary" onClick={onNeedLogin}>
          登录
        </button>
      </div>
    );
  }

  if (subView === "profile-likes" || subView === "profile-comments") {
    return (
      <div>
        <p className="m-section-title">{subView === "profile-likes" ? "收到的赞" : "收到的评论"}</p>
        {engLoading ? <p className="m-muted">加载中…</p> : null}
        {engagement.map((row) => (
          <button
            key={`${row.postId}-${row.createdAt}-${row.actor || row.author}`}
            type="button"
            className="m-post-card"
            onClick={() => onOpenPost(row.postId)}
          >
            <strong>{row.postTitle || "帖子"}</strong>
            <p className="m-muted" style={{ margin: "6px 0 0" }}>
              {row.snippet || row.content || ""}
            </p>
            <p className="m-muted">{formatPostTime(row.createdAt)}</p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <section className="m-card" style={{ textAlign: "center" }}>
        <img
          src={currentUser?.avatarUrl || avatarFromUsername(currentUser?.username)}
          alt=""
          style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover" }}
        />
        <h2 style={{ margin: "10px 0 4px" }}>{currentUser?.username}</h2>
        <p className="m-muted">{currentUser?.email}</p>
        <label className="m-btn m-btn--ghost" style={{ display: "inline-block", marginTop: 10 }}>
          更换头像
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) saveAvatar(f);
            }}
          />
        </label>
      </section>

      {loading ? <p className="m-muted">加载中…</p> : null}
      {summary ? (
        <section className="m-card">
          <p className="m-section-title">数据概览</p>
          <div className="m-admin-stat-grid">
            <div className="m-admin-stat">
              <strong>{summary.activePostCount}</strong>
              <span>活跃帖子</span>
            </div>
            <div className="m-admin-stat">
              <strong>{summary.totalViews}</strong>
              <span>总浏览</span>
            </div>
            <div className="m-admin-stat">
              <strong>{summary.totalLikes}</strong>
              <span>总赞</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="m-btn-row">
        <button type="button" className="m-btn m-btn--primary" onClick={onOpenMyPosts}>
          作品中心
        </button>
        <button type="button" className="m-btn m-btn--ghost" onClick={() => onOpenEngagement("profile-likes")}>
          收到的赞
        </button>
        <button type="button" className="m-btn m-btn--ghost" onClick={() => onOpenEngagement("profile-comments")}>
          收到的评论
        </button>
        <button type="button" className="m-btn m-btn--ghost" onClick={onLogout}>
          退出登录
        </button>
      </div>

      <section className="m-card">
        <p className="m-section-title">消息提醒</p>
        {!notifications.length ? <p className="m-muted">暂无新消息</p> : null}
        {notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            className="m-post-card"
            onClick={() => onOpenPost(n.postId)}
          >
            <strong>{n.kind === "post_like" ? "点赞" : "评论"}</strong>
            <p className="m-muted">{n.postTitle}</p>
            <p className="m-muted">{n.snippet}</p>
          </button>
        ))}
      </section>
    </div>
  );
}
