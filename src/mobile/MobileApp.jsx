import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Home, MessageSquare, User } from "lucide-react";
import { useAuthSession } from "../hooks/useAuthSession.js";
import { useAppNavigation } from "../hooks/useAppNavigation.js";
import { hideMobileTabBar, tabIdForView } from "../routing/paths.js";
import { MobileAuthModal } from "./components/MobileAuthModal.jsx";
import { MobileMiniPlayer } from "./components/MobileMiniPlayer.jsx";
import { MobileHomePage } from "./pages/MobileHomePage.jsx";
import { MobilePostsPage } from "./pages/MobilePostsPage.jsx";
import { MobileProfilePage } from "./pages/MobileProfilePage.jsx";
import { MobileMyPostsPage } from "./pages/MobileMyPostsPage.jsx";
import { MobileSharePage } from "./pages/MobileSharePage.jsx";
import { MobileColumnsPage } from "./pages/MobileColumnsPage.jsx";
import { MobileRecentPage } from "./pages/MobileRecentPage.jsx";
import { MobileAdminPage } from "./pages/MobileAdminPage.jsx";
import { MobileToolPage } from "./pages/MobileToolPage.jsx";
import { MobileAboutPage } from "./pages/MobileAboutPage.jsx";
import "./MobileApp.css";

const VIEW_TITLES = {
  home: "探索",
  posts: "帖子广场",
  schedule: "日程日历",
  profile: "我的",
  "profile-likes": "收到的赞",
  "profile-comments": "收到的评论",
  "my-posts": "作品中心",
  admin: "管理后台",
  share: "推荐分享",
  columns: "精品专栏",
  recent: "最新讨论",
  weather: "未来天气",
  time: "时间工具",
  music: "本地音乐",
  about: "关于隅言",
};

function MobileTabBar({ active, onSelect }) {
  const tabs = [
    { id: "home", label: "探索", Icon: Home },
    { id: "posts", label: "帖子", Icon: MessageSquare },
    { id: "schedule", label: "日程", Icon: CalendarDays },
    { id: "profile", label: "我的", Icon: User },
  ];
  return (
    <nav className="m-tabbar" aria-label="主导航">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={"m-tab" + (active === id ? " active" : "")}
          onClick={() => onSelect(id)}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon strokeWidth={2.2} />
          {label}
        </button>
      ))}
    </nav>
  );
}

export default function MobileApp() {
  const auth = useAuthSession();
  const nav = useAppNavigation();
  const [authModalMode, setAuthModalMode] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const showTabBar = !hideMobileTabBar(nav.view);
  const activeTab = tabIdForView(nav.view);

  const title = useMemo(() => {
    if (nav.postsCompose) return "发帖";
    if (nav.postsDetailId) return "帖子详情";
    return VIEW_TITLES[nav.view] || "隅言";
  }, [nav.view, nav.postsCompose, nav.postsDetailId]);

  const showBack =
    Boolean(nav.postsDetailId || nav.postsCompose) ||
    ["weather", "time", "music", "share", "columns", "recent", "about", "my-posts", "admin", "profile-likes", "profile-comments"].includes(
      nav.view,
    );

  const onTabSelect = useCallback(
    (tabId) => {
      if (tabId === "home") nav.goHome();
      else if (tabId === "posts") nav.goToView("posts");
      else if (tabId === "schedule") nav.goToView("schedule");
      else if (tabId === "profile") nav.goToView("profile");
    },
    [nav],
  );

  const onBack = useCallback(() => {
    if (nav.postsCompose || nav.postsDetailId) {
      nav.goToView("posts");
      return;
    }
    if (nav.view === "profile-likes" || nav.view === "profile-comments") {
      nav.goToView("profile");
      return;
    }
    if (["weather", "time", "music", "share", "columns", "recent", "about", "my-posts", "admin"].includes(nav.view)) {
      nav.goHome();
      return;
    }
    nav.goHome();
  }, [nav]);

  const openAuth = (mode) => {
    setAuthError("");
    setAuthModalMode(mode);
  };

  const closeAuth = () => {
    if (authSubmitting) return;
    setAuthModalMode(null);
    setAuthError("");
  };

  const handleLogin = async (account, password) => {
    setAuthSubmitting(true);
    setAuthError("");
    try {
      await auth.doLogin(account, password);
      setAuthModalMode(null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (username, email, password) => {
    setAuthSubmitting(true);
    setAuthError("");
    try {
      await auth.doRegister(username, email, password);
      setAuthModalMode(null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const scheduleScopeKey = auth.isLoggedIn ? `user:${auth.currentUser.id}` : "guest";
  const composeState = typeof window !== "undefined" ? window.history.state || {} : {};

  const renderBody = () => {
    switch (nav.view) {
      case "schedule":
        return <MobileToolPage kind="schedule" scheduleScopeKey={scheduleScopeKey} authToken={auth.authToken} />;
      case "weather":
        return <MobileToolPage kind="weather" />;
      case "time":
        return <MobileToolPage kind="time" />;
      case "music":
        return <MobileToolPage kind="music" />;
      case "share":
        return <MobileSharePage onNavigate={(v) => nav.goToView(v)} />;
      case "columns":
        return (
          <MobileColumnsPage
            onOpenPost={(id) => nav.goToView("posts", { postId: id, state: { from: "columns" } })}
            onOpenColumn={(tag) => nav.goToView("posts", { tag, state: { from: "columns" } })}
          />
        );
      case "recent":
        return (
          <MobileRecentPage onOpenPost={(id) => nav.goToView("posts", { postId: id, state: { from: "recent" } })} />
        );
      case "about":
        return <MobileAboutPage />;
      case "my-posts":
        return (
          <MobileMyPostsPage
            authToken={auth.authToken}
            currentUser={auth.currentUser}
            onNeedLogin={() => openAuth("login")}
            onOpenPost={(id) => nav.goToView("posts", { postId: id, state: { from: "my-posts", myPostsTab: composeState.myPostsTab } })}
            onEditPost={(p) =>
              nav.goToView("posts", {
                compose: true,
                state: { from: "my-posts", myPostsTab: composeState.myPostsTab || "active", editPost: p },
              })
            }
          />
        );
      case "profile":
      case "profile-likes":
      case "profile-comments":
        return (
          <MobileProfilePage
            authToken={auth.authToken}
            currentUser={auth.currentUser}
            subView={nav.view === "profile" ? null : nav.view}
            onNeedLogin={() => openAuth("login")}
            onLogout={auth.clearAuth}
            onOpenMyPosts={() => nav.goToView("my-posts")}
            onOpenEngagement={(v) => nav.goToView(v)}
            onOpenPost={(id) => nav.goToView("posts", { postId: id, state: { from: nav.view } })}
            onUserUpdated={auth.updateUser}
          />
        );
      case "admin":
        return (
          <MobileAdminPage
            authToken={auth.authToken}
            currentUser={auth.currentUser}
            onNeedLogin={() => openAuth("login")}
          />
        );
      case "posts":
        return (
          <MobilePostsPage
            authToken={auth.authToken}
            currentUser={auth.currentUser}
            isLoggedIn={auth.isLoggedIn}
            onNeedLogin={() => openAuth("login")}
            initialCategory={nav.postsCategorySeed}
            postsDetailId={nav.postsDetailId}
            postsCompose={nav.postsCompose}
            composeState={composeState}
            goToView={nav.goToView}
          />
        );
      case "home":
      default:
        return (
          <MobileHomePage
            isLoggedIn={auth.isLoggedIn}
            currentUser={auth.currentUser}
            onNavigate={(v) => {
              if (v === "posts") nav.goToView("posts");
              else nav.goToView(v);
            }}
            onAuth={openAuth}
          />
        );
    }
  };

  return (
    <div className="m-app" lang="zh-CN">
      <header className="m-header">
        {showBack ? (
          <button type="button" className="m-header-back" onClick={onBack} aria-label="返回">
            ←
          </button>
        ) : (
          <span style={{ width: 36 }} aria-hidden />
        )}
        <h1 className="m-header-title">{title}</h1>
        {nav.view === "posts" && !nav.postsDetailId && !nav.postsCompose ? (
          <button
            type="button"
            className="m-header-action"
            onClick={() => {
              if (!auth.isLoggedIn) openAuth("login");
              else nav.goToView("posts", { compose: true, state: { from: "posts" } });
            }}
          >
            发帖
          </button>
        ) : (
          <span style={{ width: 48 }} aria-hidden />
        )}
      </header>

      <main className={"m-main" + (showTabBar ? "" : " m-main--no-tab")}>{renderBody()}</main>

      {showTabBar ? <MobileTabBar active={activeTab} onSelect={onTabSelect} /> : null}

      <MobileMiniPlayer showTabBar={showTabBar} onOpenMusic={() => nav.goToView("music")} />

      <MobileAuthModal
        mode={authModalMode}
        onClose={closeAuth}
        onLogin={handleLogin}
        onRegister={handleRegister}
        submitting={authSubmitting}
        error={authError}
      />
    </div>
  );
}
