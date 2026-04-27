import { useCallback, useEffect, useState } from "react";

function storageKeyFor(scopeKey) {
  const safe = String(scopeKey || "guest").trim() || "guest";
  return `nooktalk-schedule-v1:${safe}`;
}

function normalize(list) {
  return list
    .map((e) => {
      if (!e || typeof e !== "object") return null;
      const startAt = Number(e.startAt);
      const id = String(e.id || "");
      const title = String(e.title || "").trim();
      if (!id || !title || !Number.isFinite(startAt)) return null;
      return {
        id,
        title,
        note: String(e.note || "").trim(),
        startAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startAt - b.startAt);
}

function loadFromStorage(scopeKey) {
  const key = storageKeyFor(scopeKey);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return normalize(Array.isArray(arr) ? arr : []);
  } catch {
    return [];
  }
}

function saveToStorage(scopeKey, list) {
  const key = storageKeyFor(scopeKey);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function isUserScope(scopeKey) {
  return String(scopeKey || "").startsWith("user:");
}

export function useSchedule(scopeKey = "guest", authToken = "") {
  const [events, setEvents] = useState(() => loadFromStorage(scopeKey));
  const useRemote = isUserScope(scopeKey) && Boolean(authToken);

  useEffect(() => {
    if (!useRemote) {
      setEvents(loadFromStorage(scopeKey));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/schedule/events", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data?.events)) {
          setEvents(normalize(data.events));
        }
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, scopeKey, useRemote]);

  const addEvent = useCallback((payload) => {
    const id =
      payload.id ||
      (globalThis.crypto?.randomUUID?.() ??
        `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const rec = {
      id,
      title: String(payload.title || "").trim(),
      note: String(payload.note || "").trim(),
      startAt: Number(payload.startAt),
    };
    if (!rec.title || !Number.isFinite(rec.startAt)) return;
    if (useRemote) {
      (async () => {
        try {
          const res = await fetch("/api/schedule/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(rec),
          });
          const data = await res.json();
          if (!res.ok) return;
          const eventOut = normalize([data?.event]).at(0);
          if (!eventOut) return;
          setEvents((prev) =>
            normalize(prev.filter((e) => e.id !== eventOut.id).concat([eventOut])),
          );
        } catch {
          // ignore transient network errors in UI for now
        }
      })();
      return;
    }
    setEvents((prev) => {
      const next = normalize(
        prev.filter((e) => e.id !== rec.id).concat([rec]),
      );
      saveToStorage(scopeKey, next);
      return next;
    });
  }, [authToken, scopeKey, useRemote]);

  const removeEvent = useCallback((id) => {
    if (useRemote) {
      (async () => {
        try {
          const res = await fetch(`/api/schedule/events/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!res.ok) return;
          setEvents((prev) => prev.filter((e) => e.id !== id));
        } catch {
          // ignore transient network errors in UI for now
        }
      })();
      return;
    }
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveToStorage(scopeKey, next);
      return next;
    });
  }, [authToken, scopeKey, useRemote]);

  useEffect(() => {
    if (useRemote) return undefined;
    const onStorage = (ev) => {
      if (ev.key === storageKeyFor(scopeKey)) setEvents(loadFromStorage(scopeKey));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [scopeKey, useRemote]);

  return { events, addEvent, removeEvent };
}
