import { useCallback, useEffect, useState } from "react";
import { formatPostTime, normalizeApiError } from "../../forum/utils.js";

export function MobileAdminPage({ authToken, currentUser, onNeedLogin }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    if (!authToken) {
      setErr("请先登录");
      setLoading(false);
      return;
    }
    if (!currentUser?.isSuperuser) {
      setErr("需要超级管理员权限");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const h = { Authorization: `Bearer ${authToken}` };
      const r1 = await fetch("/api/admin/stats", { headers: h });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(normalizeApiError(j1?.detail, "加载统计失败"));
      setStats(j1);
      const r2 = await fetch("/api/admin/users?limit=100", { headers: h });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(normalizeApiError(j2?.detail, "加载用户失败"));
      setUsers(Array.isArray(j2.items) ? j2.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [authToken, currentUser?.isSuperuser]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSilence = async (uid, prev) => {
    try {
      const res = await fetch(`/api/admin/users/${uid}/silence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ silenced: !prev }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "操作失败"));
      setUsers((list) =>
        list.map((u) => (u.id === uid ? { ...u, isSilenced: Boolean(data?.user?.isSilenced ?? !prev) } : u)),
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  if (!authToken) {
    return (
      <button type="button" className="m-btn m-btn--primary" onClick={onNeedLogin}>
        登录
      </button>
    );
  }

  return (
    <div>
      {loading ? <p className="m-muted">加载中…</p> : null}
      {err ? <p className="m-error">{err}</p> : null}
      {stats ? (
        <section className="m-card">
          <p className="m-section-title">全站统计</p>
          <div className="m-admin-stat-grid">
            <div className="m-admin-stat">
              <strong>{stats.totals?.users ?? 0}</strong>
              <span>用户</span>
            </div>
            <div className="m-admin-stat">
              <strong>{stats.totals?.posts ?? 0}</strong>
              <span>帖子</span>
            </div>
            <div className="m-admin-stat">
              <strong>{stats.totals?.comments ?? 0}</strong>
              <span>评论</span>
            </div>
            <div className="m-admin-stat">
              <strong>{stats.today?.users ?? 0}</strong>
              <span>今日新用户</span>
            </div>
          </div>
        </section>
      ) : null}
      <section className="m-card">
        <p className="m-section-title">用户管理</p>
        {users.map((u) => (
          <div key={u.id} className="m-post-card" style={{ marginBottom: 8 }}>
            <strong>@{u.username}</strong>
            <p className="m-muted">{u.email}</p>
            <p className="m-muted">{formatPostTime(u.createdAt)}</p>
            {!u.isSuperuser ? (
              <button type="button" className="m-btn m-btn--ghost" onClick={() => toggleSilence(u.id, u.isSilenced)}>
                {u.isSilenced ? "解封" : "禁言"}
              </button>
            ) : (
              <span className="m-muted">超管</span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
