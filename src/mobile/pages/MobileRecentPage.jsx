import { useCallback, useEffect, useState } from "react";
import { renderMarkdownSnippet } from "../../forum/markdown.js";
import { formatPostTime, normalizeApiError } from "../../forum/utils.js";

export function MobileRecentPage({ onOpenPost }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const offset = page * PAGE_SIZE;
      const res = await fetch(`/api/posts?tag=全部&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
      const rows = Array.isArray(data?.items) ? data.items : [];
      rows.sort((a, b) => Number(b?.createdAt || 0) - Number(a.createdAt || 0));
      setItems(rows);
      setHasNext(rows.length >= PAGE_SIZE);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {loading ? <p className="m-muted">加载中…</p> : null}
      {error ? <p className="m-error">{error}</p> : null}
      {items.map((post) => (
        <button key={post.id} type="button" className="m-post-card" onClick={() => onOpenPost(post.id)}>
          <h3>{post.title}</h3>
          <div
            className="m-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(post.body || post.excerpt || "") }}
          />
          <div className="m-post-meta">
            <span>@{post.author}</span>
            <span>{formatPostTime(post.createdAt)}</span>
          </div>
        </button>
      ))}
      <div className="m-btn-row">
        <button type="button" className="m-btn m-btn--ghost" disabled={page <= 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          上一页
        </button>
        <span className="m-muted">第 {page + 1} 页</span>
        <button type="button" className="m-btn m-btn--ghost" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
      </div>
    </div>
  );
}
