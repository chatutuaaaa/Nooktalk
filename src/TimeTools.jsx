import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Hourglass, Timer } from "lucide-react";
import "./TimeTools.css";

/** 单行 6 列，横向排满；末张为粉灰系与前几张区分 */
const CLOCK_PLACEHOLDER_BGS = [
  "linear-gradient(145deg, #c8f0d8, #e8faf0)",
  "linear-gradient(145deg, #f8e0c8, #fff5ea)",
  "linear-gradient(145deg, #d8e4ff, #f0f4ff)",
  "linear-gradient(145deg, #e8d8f8, #f5f0ff)",
  "linear-gradient(145deg, #c8e4e0, #e2f0ee)",
  "linear-gradient(145deg, #e8d4dc, #f2e8ed)",
];

function formatStopwatch(ms) {
  const clamped = Math.max(0, Math.floor(ms));
  const cs = Math.floor((clamped % 1000) / 10);
  const s = Math.floor(clamped / 1000) % 60;
  const m = Math.floor(clamped / 60000) % 60;
  const h = Math.floor(clamped / 3600000);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** 剩余毫秒转 HH:MM:SS，按整秒计，始终显示「时、分、秒」三段，末两位为秒 */
function formatCountdown(ms) {
  const v = Math.max(0, Math.floor(ms / 1000));
  const s = v % 60;
  const m = Math.floor(v / 60) % 60;
  const h = Math.floor(v / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.12;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 180);
  } catch {
    // ignore
  }
}

function useNow100ms() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TimeTools() {
  const [tab, setTab] = useState("stopwatch");
  const now100 = useNow100ms();

  return (
    <div
      className={
        "tt-page" +
        (tab === "stopwatch" || tab === "countdown" || tab === "clock"
          ? " tt-page--fill"
          : "")
      }
      lang="zh-CN"
    >
      <div className="card tt-hero">
        <h1 className="tt-hero-zh">时间工具</h1>
        <p className="tt-hero-sub">秒表、倒计时与全屏时间，常用功能集中在这里。</p>
        <div className="tt-tabs" role="tablist" aria-label="时间工具">
          {[
            { id: "stopwatch", label: "秒表", icon: Timer },
            { id: "countdown", label: "倒计时", icon: Hourglass },
            { id: "clock", label: "此刻", icon: Clock3 },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={"tt-tab" + (tab === t.id ? " active" : "")}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                <Icon size={16} strokeWidth={2.1} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "clock" ? (
        <div className="tt-clock-column">
          <div className="card tt-image-card" aria-label="六张图片占位">
            <ul className="tt-image-inner" role="list">
              {CLOCK_PLACEHOLDER_BGS.map((bg, i) => (
                <li key={i} className="tt-image-slot" aria-label={`图 ${i + 1} 占位`}>
                  <div className="tt-image-blob" style={{ background: bg }} aria-hidden />
                </li>
              ))}
            </ul>
          </div>
          <ClockPanel />
        </div>
      ) : null}

      {tab === "countdown" ? (
        <div className="tt-countdown-column">
          <div
            className="card tt-note-card"
            role="region"
            aria-label="说明文字，占位"
          >
            <p className="tt-note-placeholder">此处可展示说明、提示等文字内容。</p>
          </div>
          <CountdownPanel nowTick={now100} />
        </div>
      ) : null}

      {tab === "stopwatch" ? <StopwatchPanel nowTick={now100} /> : null}
    </div>
  );
}

function StopwatchPanel({ nowTick }) {
  const [running, setRunning] = useState(false);
  const [baseMs, setBaseMs] = useState(0);
  const [startAtTick, setStartAtTick] = useState(null);
  const [laps, setLaps] = useState([]);

  const display =
    running && startAtTick != null ? baseMs + (nowTick - startAtTick) : baseMs;

  const toggle = () => {
    if (running) {
      if (startAtTick != null) {
        setBaseMs((b) => b + (nowTick - startAtTick));
      }
      setStartAtTick(null);
      setRunning(false);
    } else {
      setStartAtTick(nowTick);
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setStartAtTick(null);
    setBaseMs(0);
    setLaps([]);
  };

  const addLap = () => {
    if (!running && baseMs === 0) return;
    const e =
      running && startAtTick != null
        ? baseMs + (nowTick - startAtTick)
        : baseMs;
    const last = laps[0]?.totalMs ?? 0;
    setLaps((prev) => [
      { id: `lap-${nowTick}-${prev.length}`, totalMs: e, splitMs: e - last },
      ...prev,
    ]);
  };

  return (
    <div className="tt-sw-outer" role="tabpanel" aria-label="秒表">
      <div className="card tt-panel tt-stopwatch-main">
        <div className="tt-readout stopwatch-readout" aria-live="polite">
          {formatStopwatch(display)}
        </div>
        <div className="tt-actions">
          <button type="button" className="tt-btn tt-btn--primary" onClick={toggle}>
            {running ? "暂停" : "开始"}
          </button>
          <button
            type="button"
            className="tt-btn"
            onClick={addLap}
            disabled={!running && baseMs === 0}
          >
            计次
          </button>
          <button type="button" className="tt-btn" onClick={reset}>
            复位
          </button>
        </div>
      </div>
      <div className="card tt-lap-card" aria-label="计次记录">
        <h2 className="tt-lap-card-title">计次</h2>
        <div
          className="tt-lap-scroll"
          role="log"
          aria-relevant="additions"
        >
          {laps.length ? (
            <ol className="tt-laps" start={laps.length} reversed>
              {laps.map((lap, i) => (
                <li key={lap.id} className="tt-lap">
                  <span className="tt-lap-n">第 {laps.length - i} 次</span>
                  <span className="tt-lap-t">{formatStopwatch(lap.splitMs)}</span>
                  <span className="tt-lap-sum">{formatStopwatch(lap.totalMs)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="tt-lap-hint">运行中点击「计次」可记录分段时间。</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CountdownPanel({ nowTick }) {
  const [mIn, setMIn] = useState(3);
  const [sIn, setSIn] = useState(0);
  const [cdState, setCdState] = useState("idle");
  /** 与 `nowTick` 同纪元：到时时刻 = 当前时刻 + 剩余毫秒 */
  const [deadlineTick, setDeadlineTick] = useState(null);
  const [pausedLeft, setPausedLeft] = useState(0);
  const finishScheduledRef = useRef(false);

  const displayMs = useMemo(() => {
    if (cdState === "running" && deadlineTick != null) {
      return Math.max(0, deadlineTick - nowTick);
    }
    if (cdState === "paused") return pausedLeft;
    return (Number(mIn) * 60 + Number(sIn)) * 1000;
  }, [cdState, deadlineTick, nowTick, pausedLeft, mIn, sIn]);

  useEffect(() => {
    if (cdState !== "running" || deadlineTick == null) {
      finishScheduledRef.current = false;
      return;
    }
    if (deadlineTick - nowTick > 0) {
      finishScheduledRef.current = false;
      return;
    }
    if (finishScheduledRef.current) return;
    finishScheduledRef.current = true;
    const t = setTimeout(() => {
      playBeep();
      setDeadlineTick(null);
      setPausedLeft(0);
      setCdState("idle");
    }, 0);
    return () => clearTimeout(t);
  }, [cdState, deadlineTick, nowTick]);

  const start = () => {
    if (cdState === "running") return;
    let ms;
    if (cdState === "paused") {
      ms = pausedLeft;
    } else {
      ms = (Number(mIn) * 60 + Number(sIn)) * 1000;
    }
    if (ms <= 0) return;
    setDeadlineTick(nowTick + ms);
    setCdState("running");
  };

  const pause = () => {
    if (cdState !== "running" || deadlineTick == null) return;
    setPausedLeft(Math.max(0, deadlineTick - nowTick));
    setDeadlineTick(null);
    setCdState("paused");
  };

  const reset = () => {
    setDeadlineTick(null);
    setPausedLeft(0);
    setCdState("idle");
  };

  return (
    <div className="tt-subpage-fill" role="tabpanel" aria-label="倒计时">
      <div className="card tt-panel tt-panel--align-bottom">
        <p className="tt-countdown-preset-hint">快捷</p>
        <div className="tt-presets">
          {[1, 3, 5, 10, 15, 25].map((m) => (
            <button
              key={m}
              type="button"
              className="tt-preset"
              onClick={() => {
                setDeadlineTick(null);
                setPausedLeft(0);
                setCdState("idle");
                setMIn(m);
                setSIn(0);
              }}
            >
              {m} 分
            </button>
          ))}
        </div>
        <div className="tt-readout countdown-readout" aria-live="polite">
          {formatCountdown(displayMs)}
        </div>
        <div className="tt-cd-inputs" aria-label="设定分秒">
          <label className="tt-inlabel">
            分
            <input
              className="tt-in"
              type="number"
              min={0}
              max={999}
              value={mIn}
              onChange={(e) => {
                if (cdState === "idle") {
                  setMIn(Number(e.target.value) || 0);
                }
              }}
              disabled={cdState !== "idle"}
            />
          </label>
          <span className="tt-insep" aria-hidden>
            :
          </span>
          <label className="tt-inlabel">
            秒
            <input
              className="tt-in"
              type="number"
              min={0}
              max={59}
              value={sIn}
              onChange={(e) => {
                if (cdState === "idle") {
                  setSIn(Math.min(59, Number(e.target.value) || 0));
                }
              }}
              disabled={cdState !== "idle"}
            />
          </label>
        </div>
        <div className="tt-actions">
          <button
            type="button"
            className="tt-btn tt-btn--primary"
            onClick={cdState === "running" ? pause : start}
          >
            {cdState === "running" ? "暂停" : cdState === "paused" ? "继续" : "开始"}
          </button>
          <button type="button" className="tt-btn" onClick={reset} disabled={cdState === "idle"}>
            重置
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockPanel() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="tt-subpage-fill" role="tabpanel" aria-label="当前时间">
      <div
        className="card tt-panel tt-panel--clock tt-panel--align-bottom"
        aria-live="polite"
      >
        <p className="tt-clock-hero">此刻</p>
        <p className="tt-clock-digital" aria-label="时">
          {t.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </p>
        <p className="tt-clock-date">
          {t.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
      </div>
    </div>
  );
}
