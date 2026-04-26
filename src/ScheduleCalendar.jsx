import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { getLunarDayLabel, getLunarMonthTitle } from "./lunarUtil";
import { useSchedule } from "./hooks/useSchedule";
import "./ScheduleCalendar.css";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISODate(s) {
  const [Y, M, D] = s.split("-").map(Number);
  if (!Y || !M || !D) return new Date();
  return new Date(Y, M - 1, D);
}

function atDateTime(ymd, hm) {
  if (!ymd) return Date.now();
  const [hh, mm] = (hm || "09:00").split(":");
  const d = fromISODate(ymd);
  d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
  return d.getTime();
}

function buildMonthGrid(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const startWeekday = first.getDay();
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
  const now = new Date();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push({ type: "pad" });
  for (let day = 1; day <= lastDate; day += 1) {
    const isToday =
      now.getDate() === day &&
      now.getMonth() === viewMonth &&
      now.getFullYear() === viewYear;
    const lunarDay = getLunarDayLabel(viewYear, viewMonth, day);
    const key = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    cells.push({ type: "day", day, isToday, lunarDay, key });
  }
  const tail = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < tail; i += 1) cells.push({ type: "pad" });
  return { cells, monthLabel: viewMonth + 1, year: viewYear };
}

function eventsByDateKey(events) {
  const m = new Map();
  for (const e of events) {
    const d = new Date(e.startAt);
    const k = toISODate(d);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.startAt - b.startAt);
  return m;
}

const REMIND_KEY = "nooktalk-schedule-fires";

function readFired() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(REMIND_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markFired(id) {
  const s = readFired();
  s.add(id);
  sessionStorage.setItem(REMIND_KEY, JSON.stringify([...s]));
}

function fireId(event) {
  return `${event.id}-${event.startAt}`;
}

export function ScheduleCalendar() {
  const { events, addEvent, removeEvent } = useSchedule();
  const [viewMode, setViewMode] = useState("month");
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selDate, setSelDate] = useState(() => toISODate(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formNote, setFormNote] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [reminder, setReminder] = useState(null);
  const firedRef = useRef(readFired());

  const [upcomingNow, setUpcomingNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setUpcomingNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const byDay = useMemo(() => eventsByDateKey(events), [events]);
  const lunarLine = useMemo(
    () => getLunarMonthTitle(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const { cells, monthLabel } = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const goPrev = () => {
    if (viewMode === "year") {
      setViewYear((y) => y - 1);
    } else {
      if (viewMonth === 0) {
        setViewYear((y) => y - 1);
        setViewMonth(11);
      } else {
        setViewMonth((m) => m - 1);
      }
    }
  };

  const goNext = () => {
    if (viewMode === "year") {
      setViewYear((y) => y + 1);
    } else {
      if (viewMonth === 11) {
        setViewYear((y) => y + 1);
        setViewMonth(0);
      } else {
        setViewMonth((m) => m + 1);
      }
    }
  };

  const goToday = () => {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setSelDate(toISODate(n));
    setViewMode("month");
  };

  const openAdd = (dateStr) => {
    setFormTitle("");
    setFormTime("09:00");
    setFormNote("");
    setEditingId(null);
    if (dateStr) setSelDate(dateStr);
    setFormOpen(true);
  };

  const onSaveForm = (e) => {
    e.preventDefault();
    const t = formTitle.trim();
    if (!t) return;
    const startAt = atDateTime(selDate, formTime);
    addEvent({ id: editingId || undefined, title: t, note: formNote, startAt });
    setFormOpen(false);
    setEditingId(null);
  };

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.startAt > upcomingNow)
        .sort((a, b) => a.startAt - b.startAt)
        .slice(0, 5),
    [events, upcomingNow],
  );

  const monthEventCount = useCallback(
    (monthIdx) =>
      events.filter((ev) => {
        const d = new Date(ev.startAt);
        return d.getFullYear() === viewYear && d.getMonth() === monthIdx;
      }).length,
    [events, viewYear],
  );

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const e of events) {
        const fid = fireId(e);
        if (firedRef.current.has(fid)) continue;
        const d = e.startAt - now;
        if (d > 0 && d <= 2 * 60 * 1000) {
          setReminder({ kind: "soon", event: e, minutes: Math.ceil(d / 60000) || 1 });
          firedRef.current.add(fid);
          markFired(fid);
          return;
        }
        if (d <= 0 && d > -2 * 60 * 1000) {
          setReminder({ kind: "now", event: e });
          firedRef.current.add(fid);
          markFired(fid);
          return;
        }
      }
    };
    const id = setInterval(check, 4000);
    check();
    return () => clearInterval(id);
  }, [events]);

  return (
    <div className="sched-page" lang="zh-CN">
      <div className="card sched-hero">
        <div className="sched-hero-titles">
          <h1 className="sched-hero-zh">日程与日历</h1>
          <p className="sched-hero-sub">同一套玻璃拟态，记录每一天的小事。</p>
        </div>
        <div className="sched-mode-bar" role="tablist" aria-label="月或年">
          <button
            type="button"
            className={"sched-mode" + (viewMode === "month" ? " active" : "")}
            role="tab"
            aria-selected={viewMode === "month"}
            onClick={() => setViewMode("month")}
          >
            <CalendarDays size={16} strokeWidth={2.1} />
            月视图
          </button>
          <button
            type="button"
            className={"sched-mode" + (viewMode === "year" ? " active" : "")}
            role="tab"
            aria-selected={viewMode === "year"}
            onClick={() => setViewMode("year")}
          >
            年视图
          </button>
        </div>
        <div className="sched-toolbar">
          {viewMode === "month" ? (
            <div className="sched-date-nav" aria-label="选择月份">
              <button
                className="sched-icon-btn"
                type="button"
                onClick={goPrev}
                aria-label="上一个月"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="sched-date-titles">
                <span className="sched-greg">
                  {viewYear} 年 {monthLabel} 月
                </span>
                {lunarLine ? (
                  <span className="sched-lunar-hint">{lunarLine}</span>
                ) : null}
              </div>
              <button
                className="sched-icon-btn"
                type="button"
                onClick={goNext}
                aria-label="下一个月"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ) : (
            <div className="sched-date-nav" aria-label="选择年份">
              <button
                className="sched-icon-btn"
                type="button"
                onClick={goPrev}
                aria-label="上一年"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="sched-date-titles">
                <span className="sched-greg">{viewYear} 年</span>
                <span className="sched-lunar-hint">全年 12 个月一览</span>
              </div>
              <button
                className="sched-icon-btn"
                type="button"
                onClick={goNext}
                aria-label="下一年"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          <div className="sched-toolbar-right">
            <button type="button" className="sched-pill" onClick={goToday}>
              今天
            </button>
            <button
              type="button"
              className="sched-pill sched-pill--primary"
              onClick={() => openAdd(selDate)}
            >
              <Plus size={16} />
              添加日程
            </button>
          </div>
        </div>
      </div>

      <div
        className={
          "sched-body" + (viewMode === "month" ? " sched-body--with-side" : "")
        }
      >
        {viewMode === "year" ? (
          <div className="card sched-year-grid" aria-label="年视图">
            {Array.from({ length: 12 }, (_, i) => {
              const count = monthEventCount(i);
              return (
                <button
                  key={i}
                  type="button"
                  className="sched-year-cell"
                  onClick={() => {
                    setViewMonth(i);
                    setViewMode("month");
                  }}
                >
                  <span className="sched-year-m">{i + 1} 月</span>
                  {count > 0 ? (
                    <span className="sched-year-c">{count} 项日程</span>
                  ) : (
                    <span className="sched-year-c muted">无日程</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}

        {viewMode === "month" ? (
          <>
            <div className="card sched-month-card">
              <div className="sched-week" aria-hidden>
                {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                  <div key={d} className="sched-weekday">
                    {d}
                  </div>
                ))}
              </div>
              <div className="sched-grid" role="grid" aria-label="月历格">
                {cells.map((c, i) => {
                  if (c.type === "pad")
                    return <div key={`p-${i}`} className="sched-day muted" />;
                  const list = byDay.get(c.key) || [];
                  const n = list.length;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className={
                        "sched-day" +
                        (c.isToday ? " today" : "") +
                        (selDate === c.key ? " selected" : "")
                      }
                      onClick={() => setSelDate(c.key)}
                      role="gridcell"
                      aria-pressed={selDate === c.key}
                      aria-label={`${c.key} 公历 ${
                        c.lunarDay ? "农历" + c.lunarDay : ""
                      }`.trim()}
                    >
                      <span className="sched-solar">{c.day}</span>
                      {c.lunarDay ? (
                        <span className="sched-lunar-d">{c.lunarDay}</span>
                      ) : null}
                      {n > 0 ? (
                        <span className="sched-dot-wrap" title={`${n} 项`}>
                          {n > 3
                            ? Array.from({ length: 3 }, (_, j) => (
                                <span key={j} className="sched-dot" />
                              ))
                            : list.map((ev) => (
                                <span key={ev.id} className="sched-dot" />
                              ))}
                          {n > 3 ? <span className="sched-dot-more">+</span> : null}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sched-side">
              <div className="card sched-detail-card">
                <h2 className="sched-panel-title">当日日程</h2>
                <p className="sched-panel-date">
                  {fromISODate(selDate).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </p>
                <ul className="sched-list" aria-label="已选日期的日程">
                  {(byDay.get(selDate) || []).length ? (
                    (byDay.get(selDate) || []).map((ev) => {
                      const timeStr = new Date(ev.startAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                      return (
                        <li key={ev.id} className="sched-list-item">
                          <div>
                            <div className="sched-item-title">{ev.title}</div>
                            <div className="sched-item-time">{timeStr}</div>
                            {ev.note ? (
                              <div className="sched-item-note">{ev.note}</div>
                            ) : null}
                          </div>
                          <div className="sched-item-actions">
                            <button
                              type="button"
                              className="sched-mini-btn"
                              onClick={() => {
                                setEditingId(ev.id);
                                setFormTitle(ev.title);
                                setFormTime(
                                  new Date(ev.startAt).toLocaleTimeString("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  }),
                                );
                                setFormNote(ev.note);
                                setSelDate(toISODate(new Date(ev.startAt)));
                                setFormOpen(true);
                              }}
                              title="编辑"
                            >
                              改
                            </button>
                            <button
                              type="button"
                              className="sched-mini-btn danger"
                              onClick={() => removeEvent(ev.id)}
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="sched-empty">
                      这一天没有日程。点击「添加日程」或选其它日期。
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  className="sched-pill sched-pill--block"
                  onClick={() => openAdd(selDate)}
                >
                  <Plus size={16} />
                  为这一天添加
                </button>
              </div>

              <div className="card sched-upcoming-card">
                <h2 className="sched-panel-title">
                  <Bell size={16} className="sched-inline-icon" strokeWidth={2.2} />
                  即将开始
                </h2>
                {upcoming.length ? (
                  <ul className="sched-upcoming-list">
                    {upcoming.map((ev) => {
                      const d = new Date(ev.startAt);
                      return (
                        <li key={ev.id}>
                          <span className="sched-up-title">{ev.title}</span>
                          <span className="sched-up-meta">
                            {d.toLocaleString("zh-CN", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="sched-empty">暂无未开始的日程。</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {formOpen ? (
        <div
          className="sched-modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sched-form-title"
        >
          <button
            type="button"
            className="sched-modal-backdrop"
            onClick={() => {
              setFormOpen(false);
              setEditingId(null);
            }}
            aria-label="关闭"
          />
          <form className="card sched-form" onSubmit={onSaveForm}>
            <div className="sched-form-head">
              <h2 id="sched-form-title" className="sched-form-h">
                {editingId ? "编辑日程" : "添加日程"}
              </h2>
              <button
                type="button"
                className="sched-icon-btn"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>
            <label className="sched-label">
              标题
              <input
                className="sched-input"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder="例如 隅言稿件截止"
                autoFocus
              />
            </label>
            <label className="sched-label">
              日期
              <input
                className="sched-input"
                type="date"
                value={selDate}
                onChange={(e) => setSelDate(e.target.value)}
                required
              />
            </label>
            <label className="sched-label">
              时间
              <input
                className="sched-input"
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                required
              />
            </label>
            <label className="sched-label">
              备注（选填）
              <textarea
                className="sched-textarea"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={2}
                placeholder="地点、提醒说明…"
              />
            </label>
            <div className="sched-form-actions">
              <button
                type="button"
                className="sched-pill"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
              >
                取消
              </button>
              <button type="submit" className="sched-pill sched-pill--primary">
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {reminder ? (
        <div className="sched-modal-root" role="alertdialog" aria-modal="true" aria-live="assertive">
          <button
            type="button"
            className="sched-modal-backdrop"
            onClick={() => setReminder(null)}
            aria-label="关闭"
          />
          <div className="card sched-remind">
            <div className="sched-remind-icon" aria-hidden>
              <Bell size={24} />
            </div>
            {reminder.kind === "soon" ? (
              <p className="sched-remind-text">
                <strong>「{reminder.event.title}」</strong>
                将在约 {reminder.minutes} 分钟内开始。
              </p>
            ) : (
              <p className="sched-remind-text">
                <strong>「{reminder.event.title}」</strong>
                到达设定时间，祝顺利。
              </p>
            )}
            <p className="sched-remind-time">
              {new Date(reminder.event.startAt).toLocaleString("zh-CN", {
                dateStyle: "medium",
                timeStyle: "short",
                hour12: false,
              })}
            </p>
            <button
              type="button"
              className="sched-pill sched-pill--primary sched-pill--block"
              onClick={() => setReminder(null)}
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
