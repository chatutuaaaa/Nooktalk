import { useCallback, useEffect, useState } from "react";
import { FORUM_CATEGORIES } from "../../forum/constants.js";
import { handleMarkdownCodeCopyClick, renderMarkdown, renderMarkdownSnippet } from "../../forum/markdown.js";
import { formatPostTime, normalizeApiError, parseTopicsText } from "../../forum/utils.js";

export function MobilePostsPage({
  authToken,
  currentUser,
  isLoggedIn,
  onNeedLogin,
  initialCategory,
  postsDetailId,
  postsCompose,
  composeState,
  goToView,
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory || "全部");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [likeSubmitting, setLikeSubmitting] = useState(false);
  const [composeForm, setComposeForm] = useState({
    title: "",
    tag: "闲聊",
    topicsText: "",
    body: "",
  });
  const [composeError, setComposeError] = useState("");
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  const silenced = Boolean(currentUser?.isSilenced);
  const editPost = composeState?.editPost;

  useEffect(() => {
    setActiveCategory(initialCategory || "全部");
  }, [initialCategory]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (activeCategory) q.set("tag", activeCategory);
      const res = await fetch(`/api/posts?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
      setPosts(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setPosts([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (!postsDetailId && !postsCompose) loadPosts();
  }, [loadPosts, postsDetailId, postsCompose]);

  const loadDetail = useCallback(
    async (postId, increment = true) => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const query = new URLSearchParams({ increment_view: String(increment) });
        const headers = {};
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        const res = await fetch(`/api/posts/${postId}?${query}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(normalizeApiError(data?.detail, "加载失败"));
        setDetail(data);
      } catch (e) {
        setDetail(null);
        setDetailError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setDetailLoading(false);
      }
    },
    [authToken],
  );

  useEffect(() => {
    if (postsDetailId) loadDetail(postsDetailId, true);
  }, [postsDetailId, loadDetail]);

  useEffect(() => {
    if (!postsCompose) return;
    if (editPost) {
      setComposeForm({
        title: editPost.title || "",
        tag: editPost.tag || "闲聊",
        topicsText: Array.isArray(editPost.topics) ? editPost.topics.map((t) => `#${t}`).join(" ") : "",
        body: editPost.body || "",
      });
    } else {
      setComposeForm({ title: "", tag: "闲聊", topicsText: "", body: "" });
    }
    setComposeError("");
  }, [postsCompose, editPost]);

  const openCompose = (edit = null) => {
    if (!isLoggedIn) {
      onNeedLogin();
      return;
    }
    goToView("posts", {
      compose: true,
      state: {
        from: composeState?.from || "posts",
        myPostsTab: composeState?.myPostsTab || "active",
        editPost: edit,
      },
    });
  };

  const submitPost = async (e) => {
    e.preventDefault();
    if (!authToken) return onNeedLogin();
    if (silenced) return window.alert("您已被禁言，暂时无法发帖");
    const title = composeForm.title.trim();
    const body = composeForm.body.trim();
    if (title.length < 2 || body.length < 2) {
      setComposeError("标题和正文至少 2 个字符");
      return;
    }
    setComposeSubmitting(true);
    setComposeError("");
    try {
      const isEdit = Boolean(editPost?.id);
      const res = await fetch(isEdit ? `/api/posts/${editPost.id}` : "/api/posts", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          title,
          body,
          tag: composeForm.tag,
          topics: parseTopicsText(composeForm.topicsText),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "提交失败"));
      if (composeState?.from === "my-posts") {
        goToView("my-posts", { state: { myPostsTab: composeState.myPostsTab } });
      } else {
        goToView("posts");
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setComposeSubmitting(false);
    }
  };

  const toggleLike = async () => {
    if (!postsDetailId || !authToken) return onNeedLogin();
    if (likeSubmitting) return;
    setLikeSubmitting(true);
    try {
      const liked = Boolean(detail?.likedByMe);
      const res = await fetch(`/api/posts/${postsDetailId}/like`, {
        method: liked ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "操作失败"));
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              likedByMe: !liked,
              item: {
                ...prev.item,
                stats: { ...prev.item.stats, likes: Number(data?.likes ?? prev.item.stats?.likes ?? 0) },
              },
            }
          : prev,
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "点赞失败");
    } finally {
      setLikeSubmitting(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!postsDetailId || !authToken) return onNeedLogin();
    if (silenced) return window.alert("您已被禁言");
    const content = commentText.trim();
    if (!content) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postsDetailId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(normalizeApiError(data?.detail, "评论失败"));
      setCommentText("");
      await loadDetail(postsDetailId, false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "评论失败");
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (postsCompose) {
    return (
      <form className="m-form" onSubmit={submitPost}>
        <p className="m-section-title">{editPost ? "编辑帖子" : "发帖"}</p>
        {composeError ? <p className="m-error">{composeError}</p> : null}
        <label>
          标题
          <input value={composeForm.title} onChange={(e) => setComposeForm((p) => ({ ...p, title: e.target.value }))} />
        </label>
        <label>
          分类
          <select value={composeForm.tag} onChange={(e) => setComposeForm((p) => ({ ...p, tag: e.target.value }))}>
            {FORUM_CATEGORIES.filter((c) => !["全部", "热门"].includes(c)).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          话题（空格分隔，可加 #）
          <input
            value={composeForm.topicsText}
            onChange={(e) => setComposeForm((p) => ({ ...p, topicsText: e.target.value }))}
          />
        </label>
        <label>
          正文（Markdown）
          <textarea
            value={composeForm.body}
            onChange={(e) => setComposeForm((p) => ({ ...p, body: e.target.value }))}
            rows={12}
          />
        </label>
        <button type="submit" className="m-btn m-btn--primary" style={{ width: "100%" }} disabled={composeSubmitting}>
          {composeSubmitting ? "提交中…" : editPost ? "保存" : "发布"}
        </button>
      </form>
    );
  }

  if (postsDetailId) {
    const item = detail?.item;
    return (
      <div>
        {detailLoading ? <p className="m-muted">加载中…</p> : null}
        {detailError ? <p className="m-error">{detailError}</p> : null}
        {item ? (
          <>
            <article className="m-card">
              <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{item.title}</h2>
              <p className="m-muted">
                @{item.author} · {item.tag} · {formatPostTime(item.createdAt)}
              </p>
              <div
                className="m-markdown markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body || "") }}
                onClick={(e) => handleMarkdownCodeCopyClick(e)}
              />
              <div className="m-detail-actions">
                <button type="button" className="m-btn m-btn--ghost" onClick={toggleLike} disabled={likeSubmitting}>
                  {detail?.likedByMe ? "取消赞" : "点赞"} ({item.stats?.likes ?? 0})
                </button>
                <span className="m-muted">浏览 {item.stats?.views ?? 0}</span>
              </div>
            </article>
            <section className="m-card">
              <p className="m-section-title">评论 ({item.stats?.comments ?? 0})</p>
              {(detail?.comments || []).map((c) => (
                <div key={c.id} className="m-comment">
                  <p className="m-muted" style={{ margin: "0 0 4px" }}>
                    @{c.author} · {formatPostTime(c.createdAt)}
                  </p>
                  <p style={{ margin: 0 }}>{c.content}</p>
                </div>
              ))}
              {isLoggedIn ? (
                <form onSubmit={submitComment} style={{ marginTop: 12 }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="写下评论…"
                    rows={3}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: 10 }}
                  />
                  <button type="submit" className="m-btn m-btn--primary" disabled={commentSubmitting}>
                    {commentSubmitting ? "发送中…" : "发送"}
                  </button>
                </form>
              ) : (
                <button type="button" className="m-btn m-btn--ghost" onClick={onNeedLogin}>
                  登录后评论
                </button>
              )}
            </section>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="m-chip-row" style={{ marginBottom: 12 }}>
        {FORUM_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={"m-chip" + (activeCategory === c ? " active" : "")}
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <button type="button" className="m-btn m-btn--primary" style={{ width: "100%", marginBottom: 12 }} onClick={() => openCompose()}>
        发帖
      </button>
      {loading ? <p className="m-muted">加载中…</p> : null}
      {error ? <p className="m-error">{error}</p> : null}
      {posts.map((post) => (
        <button
          key={post.id}
          type="button"
          className="m-post-card"
          onClick={() => goToView("posts", { postId: post.id, state: { from: "posts" } })}
        >
          <h3>{post.title}</h3>
          <div
            className="m-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSnippet(post.body || post.excerpt || "") }}
          />
          <div className="m-post-meta">
            <span>@{post.author}</span>
            <span>{post.tag}</span>
            <span>{post.stats?.views ?? 0} 浏览</span>
            <span>{post.stats?.likes ?? 0} 赞</span>
          </div>
        </button>
      ))}
    </div>
  );
}
