import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nooktalk-schedule-v1";

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

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return normalize(Array.isArray(arr) ? arr : []);
  } catch {
    return [];
  }
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function useSchedule() {
  const [events, setEvents] = useState(() => loadFromStorage());

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
    setEvents((prev) => {
      const next = normalize(
        prev.filter((e) => e.id !== rec.id).concat([rec]),
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeEvent = useCallback((id) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === STORAGE_KEY) setEvents(loadFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { events, addEvent, removeEvent };
}
