import { useCallback, useEffect, useState } from "react";
import {
  adminPathname,
  columnsPathname,
  homePathname,
  isPostsComposePathname,
  musicPathname,
  myPostsPathname,
  postsComposePathname,
  postsDetailPathname,
  postsDetailIdFromPathname,
  postsPathname,
  profilePathname,
  profileReceivedCommentsPathname,
  profileReceivedLikesPathname,
  recentPathname,
  schedulePathname,
  sharePathname,
  timePathname,
  viewFromPathname,
  weatherPathname,
  aboutPathname,
} from "../routing/paths.js";
import { FORUM_CATEGORIES } from "../forum/constants.js";

export function useAppNavigation() {
  const [view, setView] = useState(() => (typeof window !== "undefined" ? viewFromPathname() : "home"));
  const [postsCategorySeed, setPostsCategorySeed] = useState(() => {
    if (typeof window === "undefined") return "全部";
    const t = window.history.state?.tag;
    return typeof t === "string" && FORUM_CATEGORIES.includes(t) ? t : "全部";
  });

  useEffect(() => {
    const onPop = () => {
      setView(viewFromPathname());
      const t = window.history.state?.tag;
      if (typeof t === "string" && FORUM_CATEGORIES.includes(t)) {
        setPostsCategorySeed(t);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goToView = useCallback((nextView, options = {}) => {
    const { tag, postId, state = {}, replace = false } = options;
    let url = homePathname();
    let historyState = { view: nextView, ...state };

    switch (nextView) {
      case "schedule":
        url = schedulePathname();
        break;
      case "weather":
        url = weatherPathname();
        break;
      case "time":
        url = timePathname();
        break;
      case "music":
        url = musicPathname();
        break;
      case "recent":
        url = recentPathname();
        break;
      case "share":
        url = sharePathname();
        break;
      case "columns":
        url = columnsPathname();
        break;
      case "about":
        url = aboutPathname();
        break;
      case "my-posts":
        url = myPostsPathname();
        break;
      case "profile":
        url = profilePathname();
        break;
      case "profile-likes":
        url = profileReceivedLikesPathname();
        break;
      case "profile-comments":
        url = profileReceivedCommentsPathname();
        break;
      case "admin":
        url = adminPathname();
        break;
      case "posts":
        if (postId) {
          url = postsDetailPathname(postId);
          historyState = { view: "posts-detail", postId, ...state };
        } else if (options.compose) {
          url = postsComposePathname();
          historyState = { view: "posts-compose", ...state };
        } else {
          url = postsPathname();
          const tagNorm =
            typeof tag === "string" && FORUM_CATEGORIES.includes(tag) ? tag : "全部";
          setPostsCategorySeed(tagNorm);
          historyState = { view: "posts", tag: tagNorm === "全部" ? null : tagNorm, ...state };
        }
        break;
      default:
        url = homePathname();
        historyState = { view: "home" };
    }

    if (replace) {
      history.replaceState(historyState, "", url);
    } else {
      history.pushState(historyState, "", url);
    }
    setView(viewFromPathname());
  }, []);

  const postsDetailId = postsDetailIdFromPathname();
  const postsCompose = isPostsComposePathname();

  return {
    view,
    postsCategorySeed,
    postsDetailId,
    postsCompose,
    goToView,
    goHome: () => goToView("home"),
  };
}
