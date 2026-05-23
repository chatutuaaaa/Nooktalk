import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "nooktalk_token";

export function useAuthSession() {
  const [authToken, setAuthToken] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) || "" : "",
  );
  const [currentUser, setCurrentUser] = useState(null);

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
          window.localStorage.removeItem(TOKEN_KEY);
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
    window.localStorage.setItem(TOKEN_KEY, token);
  }, []);

  const clearAuth = useCallback(() => {
    setCurrentUser(null);
    setAuthToken("");
    window.localStorage.removeItem(TOKEN_KEY);
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

  const updateUser = useCallback((user) => {
    if (user) setCurrentUser(user);
  }, []);

  return {
    authToken,
    currentUser,
    isLoggedIn: Boolean(currentUser && authToken),
    persistAuth,
    clearAuth,
    doLogin,
    doRegister,
    updateUser,
  };
}
