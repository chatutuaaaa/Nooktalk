import { Pause, Play, SkipForward } from "lucide-react";
import { useMusicPlayback } from "../../useMusicPlayback.js";

export function MobileMiniPlayer({ showTabBar, onOpenMusic }) {
  const {
    hasTracks,
    cur,
    playing,
    togglePlay,
    goNext,
    formatTime,
    currentTime,
    duration,
  } = useMusicPlayback();

  if (!hasTracks) return null;

  return (
    <div
      className={"m-mini-player" + (showTabBar ? "" : " m-mini-player--no-tab")}
      role="button"
      tabIndex={0}
      onClick={onOpenMusic}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenMusic();
      }}
    >
      <div className="m-mini-player-titles">
        <p>{cur?.title || "—"}</p>
        <p className="m-muted">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      </div>
      <button
        type="button"
        className="m-btn m-btn--ghost"
        aria-label={playing ? "暂停" : "播放"}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button
        type="button"
        className="m-btn m-btn--ghost"
        aria-label="下一曲"
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
      >
        <SkipForward size={18} />
      </button>
    </div>
  );
}
