import { useCallback, useEffect, useState } from "react";
import { FEATURED_COLUMNS, FORUM_TOPIC_TAGS } from "../../forum/constants.js";
import { normalizeApiError } from "../../forum/utils.js";

export function MobileColumnsPage({ onOpenPost, onOpenColumn }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [columnsData, setColumnsData] = useState(() => FEATURED_COLUMNS.map((c) => ({ ...c, posts: [] })));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        FEATURED_COLUMNS.map(async (col) => {
          const res = await fetch(`/api/posts?tag=${encodeURIComponent(col.tag)}&limit=12`);
          const data = await res.json();
          if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
          let rows = Array.isArray(data?.items) ? data.items : [];
          rows.sort((a, b) => {
            const ap = a.pinned ? 1 : 0;
            const bp = b.pinned ? 1 : 0;
            if (bp !== ap) return bp - ap;
            const hotA = (a.stats?.comments || 0) * 3 + (a.stats?.likes || 0) * 2 + (a.stats?.views || 0);
            const hotB = (b.stats?.comments || 0) * 3 + (b.stats?.likes || 0) * 2 + (b.stats?.views || 0);
            return hotB - hotA || Number(b.createdAt || 0) - Number(a.createdAt || 0);
          });
          return { ...col, posts: rows.slice(0, 5) };
        }),
      );
      setColumnsData(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setColumnsData(FEATURED_COLUMNS.map((c) => ({ ...c, posts: [] })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {loading ? <p className="m-muted">加载中…</p> : null}
      {error ? <p className="m-error">{error}</p> : null}
      {columnsData.map((col) => (
        <section key={col.tag} className="m-card">
          <p className="m-section-title">
            {col.glyph} {col.title}
          </p>
          <p className="m-muted">{col.desc}</p>
          {col.posts.length ? (
            <ol style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {col.posts.map((p) => (
                <li key={p.id} style={{ marginBottom: 8 }}>
                  <button type="button" className="m-btn m-btn--ghost" style={{ width: "100%", textAlign: "left" }} onClick={() => onOpenPost(p.id, col.tag)}>
                    {p.title}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-muted">暂无帖子</p>
          )}
          <button type="button" className="m-btn m-btn--primary" style={{ marginTop: 8 }} onClick={() => onOpenColumn(col.tag)}>
            进入{col.tag}专栏
          </button>
        </section>
      ))}
      <section className="m-card">
        <p className="m-section-title">推荐话题</p>
        <div className="m-chip-row">
          {FORUM_TOPIC_TAGS.map((t) => (
            <span key={t} className="m-chip">
              {t}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
