/** URL helpers aligned with Vite `base` and History API routing. */

const baseUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

export function homePathname() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
}

export function schedulePathname() {
  return new URL("schedule", baseUrl()).pathname;
}

export function weatherPathname() {
  return new URL("weather", baseUrl()).pathname;
}

export function timePathname() {
  return new URL("time", baseUrl()).pathname;
}

export function musicPathname() {
  return new URL("music", baseUrl()).pathname;
}

export function postsPathname() {
  return new URL("posts", baseUrl()).pathname;
}

export function recentPathname() {
  return new URL("recent", baseUrl()).pathname;
}

export function myPostsPathname() {
  return new URL("my-posts", baseUrl()).pathname;
}

export function profilePathname() {
  return new URL("profile", baseUrl()).pathname;
}

export function profileReceivedLikesPathname() {
  return new URL("profile/received-likes", baseUrl()).pathname;
}

export function profileReceivedCommentsPathname() {
  return new URL("profile/received-comments", baseUrl()).pathname;
}

export function postsComposePathname() {
  return new URL("posts/new", baseUrl()).pathname;
}

export function isPostsComposePathname(pathname = window.location.pathname) {
  return pathname === postsComposePathname();
}

export function postsDetailPathname(postId) {
  return new URL(`posts/${postId}`, baseUrl()).pathname;
}

export function adminPathname() {
  return new URL("admin", baseUrl()).pathname;
}

export function sharePathname() {
  return new URL("share", baseUrl()).pathname;
}

export function columnsPathname() {
  return new URL("columns", baseUrl()).pathname;
}

export function aboutPathname() {
  return new URL("about", baseUrl()).pathname;
}

export function absUrlForPathname(pathname) {
  if (typeof window === "undefined") return pathname || "/";
  return `${window.location.origin}${pathname || "/"}`;
}

export function postsDetailIdFromPathname(pathname = window.location.pathname) {
  const base = postsPathname().replace(/\/$/, "");
  const p = String(pathname || "").replace(/\/$/, "");
  const m = p.match(new RegExp(`^${base}/(\\d+)$`));
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function viewFromPathname(pathname = window.location.pathname) {
  const p = pathname;
  if (p === schedulePathname()) return "schedule";
  if (p === weatherPathname()) return "weather";
  if (p === timePathname()) return "time";
  if (p === musicPathname()) return "music";
  if (p === recentPathname()) return "recent";
  if (p === profileReceivedLikesPathname()) return "profile-likes";
  if (p === profileReceivedCommentsPathname()) return "profile-comments";
  if (p === profilePathname()) return "profile";
  if (p === adminPathname()) return "admin";
  if (p === sharePathname()) return "share";
  if (p === columnsPathname()) return "columns";
  if (p === aboutPathname()) return "about";
  if (p === myPostsPathname()) return "my-posts";
  if (p === postsPathname() || p === postsComposePathname() || postsDetailIdFromPathname(p)) return "posts";
  return "home";
}

/** Primary bottom-tab id for a view (null = no tab highlight). */
export function tabIdForView(view) {
  if (view === "home" || view === "weather" || view === "time" || view === "music" || view === "share" || view === "columns" || view === "recent" || view === "about") {
    return "home";
  }
  if (view === "posts") return "posts";
  if (view === "schedule") return "schedule";
  if (view === "profile" || view === "profile-likes" || view === "profile-comments" || view === "my-posts" || view === "admin") {
    return "profile";
  }
  return "home";
}

export function hideMobileTabBar(view) {
  return view === "admin" || isPostsComposePathname() || Boolean(postsDetailIdFromPathname());
}
