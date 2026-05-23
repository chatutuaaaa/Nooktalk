import { useCallback, useEffect, useMemo, useState } from "react";
import { renderMarkdownSnippet } from "../../forum/markdown.js";
import { formatPostTime, normalizeApiError } from "../../forum/utils.js";

export function MobileMyPostsPage({ authToken, currentUser, onNeedLogin, onOpenPost, onEditPost }) {
  const [postView, setPostView] = useState("active");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authToken || !currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/posts/mine?include_deleted=true&limit=200", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [authToken, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((p) => (postView === "deleted" ? Boolean(p.deleted) : !p.deleted)),
    [items, postView],
  );

  if (!authToken) {
    return (
      <div className="m-card">
        <p className="m-muted">登录后查看作品中心</p>
        <button type="button" className="m-btn m-btn--primary" onClick={onNeedLogin}>
          登录
        </button>
      </div>
    );
  }

  const deletePost = async (postId) => {
    if (!window.confirm("确认删除？30 天内可恢复")) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "删除失败"));
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, deleted: true } : p)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const restorePost = async (postId) => {
    try {
      const res = await fetch(`/api/posts/${postId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "恢复失败"));
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, deleted: false } : p)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "恢复失败");
    }
  };

  return (
    <div>
      <div className="m-chip-row">
        <button type="button" className={"m-chip" + (postView === "active" ? " active" : "")} onClick={() => setPostView("active")}>
          已发布
        </button>
        <button type="button" className={"m-chip" + (postView === "deleted" ? " active" : "")} onClick={() => setPostView("deleted")}>
          已删除
        </button>
      </div>
      {loading ? <p className="m-muted">加载中…</p> : null}
      {error ? <p className="m-error">{error}</p> : null}
      {filtered.map((p) => (
        <article key={p.id} className="m-post-card">
          <button type="button" style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0 }} onClick={() => onOpenPost(p.id)}>
            <h3>{p.title}</h3>
            <div
              className="m-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(p.body || p.excerpt || "") }}
            />
          </button>
          <div className="m-btn-row" style={{ marginTop: 8 }}>
            {postView === "deleted" ? (
              <button type="button" className="m-btn m-btn--ghost" onClick={() => restorePost(p.id)}>
                恢复
              </button>
            ) : (
              <>
                <button type="button" className="m-btn m-btn--ghost" onClick={() => onEditPost(p)}>
                  编辑
                </button>
                <button type="button" className="m-btn m-btn--ghost" onClick={() => deletePost(p.id)}>
                  删除
                </button>
              </>
            )}
          </div>
          <div className="m-post-meta">
            <span>{formatPostTime(p.createdAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
