import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { MusicPlaybackContext } from "./musicPlaybackContext.js";
import { formatMusicTime } from "./musicFormat.js";

export function MusicPlaybackProvider({ children }) {
  const [tracks, setTracks] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [activeI, setActiveI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/music/tracks");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        const list = Array.isArray(d.tracks) ? d.tracks : [];
        setTracks(list);
        setListError(null);
        setActiveI(0);
        setCurrentTime(0);
        setDuration(0);
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : "加载失败");
          setTracks([]);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cur = tracks[activeI];
  const hasTracks = tracks.length > 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !cur?.url) return;
    if (a.paused) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [cur?.url]);

  const goPrev = useCallback(() => {
    if (tracks.length === 0) return;
    setActiveI((i) => (i - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  const goNext = useCallback(() => {
    if (tracks.length === 0) return;
    setActiveI((i) => (i + 1) % tracks.length);
  }, [tracks.length]);

  const seekFromBarEvent = useCallback(
    (e, barElement) => {
      const a = audioRef.current;
      if (!a || !barElement || !Number.isFinite(duration) || duration <= 0) return;
      e.preventDefault();
      const rect = barElement.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return;
      const t = (e.clientX - rect.left) / w;
      a.currentTime = Math.max(0, Math.min(1, t)) * duration;
    },
    [duration]
  );

  const nudgeBySeconds = useCallback(
    (delta) => {
      const a = audioRef.current;
      if (!a || !Number.isFinite(duration) || duration <= 0) return;
      a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
    },
    [duration]
  );

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !cur?.url) return;
    if (!playing) return;
    const go = () => {
      void a.play().catch(() => setPlaying(false));
    };
    if (a.readyState >= 2) go();
    else a.addEventListener("canplay", go, { once: true });
  }, [cur?.url, activeI, playing]);

  const onEnded = useCallback(() => {
    if (tracks.length === 0) return;
    setActiveI((i) => (i + 1) % tracks.length);
  }, [tracks.length]);

  const value = useMemo(
    () => ({
      tracks,
      listLoading,
      listError,
      activeI,
      setActiveI,
      playing,
      currentTime,
      duration,
      progress,
      hasTracks,
      cur,
      listEmpty: !listLoading && !listError && !hasTracks,
      formatTime: formatMusicTime,
      togglePlay,
      goPrev,
      goNext,
      seekFromBarEvent,
      nudgeBySeconds,
    }),
    [
      tracks,
      listLoading,
      listError,
      activeI,
      playing,
      currentTime,
      duration,
      progress,
      hasTracks,
      cur,
      togglePlay,
      goPrev,
      goNext,
      seekFromBarEvent,
      nudgeBySeconds,
    ]
  );

  return (
    <MusicPlaybackContext.Provider value={value}>
      <audio
        key={cur?.url ?? "music-audio-idle"}
        ref={audioRef}
        className="mplayer-audio"
        src={cur?.url}
        onLoadStart={() => {
          setCurrentTime(0);
          setDuration(0);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setCurrentTime(0);
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={(e) => {
          if (e.currentTarget.ended) return;
          setPlaying(false);
        }}
        onEnded={onEnded}
        preload="metadata"
      />
      <div className="app-layout">{children}</div>
    </MusicPlaybackContext.Provider>
  );
}
