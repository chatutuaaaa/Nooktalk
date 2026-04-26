import { useRef } from "react";
import { ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useMusicPlayback } from "./useMusicPlayback.js";
import "./MusicPlayer.css";

export function MusicPlayer() {
  const {
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
    formatTime,
    togglePlay,
    goPrev,
    goNext,
    seekFromBarEvent,
    nudgeBySeconds,
  } = useMusicPlayback();
  const scrubRef = useRef(null);

  return (
    <div className="mplayer-page" lang="zh-CN">
      <div className="card mplayer-hero">
        <h1 className="mplayer-hero-zh">音乐</h1>
        <p className="mplayer-hero-sub">
          将音频文件（mp3、flac、ogg 等）放入项目根目录的 <code>music</code> 文件夹，并运行本地
          API（<code>uvicorn</code>）。播放进度与 Vite 开发代理下的 <code>/api/music</code> 联动。
        </p>
      </div>

      <div className="card mplayer-now" aria-label="正在播放">
        {listLoading ? (
          <p className="mplayer-hint" role="status">
            正在加载曲库…
          </p>
        ) : listError ? (
          <p className="mplayer-hint" role="status">
            无法拉取曲库：{listError}。请确认已启动 <code>api</code> 且可访问 <code>/api/music/tracks</code>。
          </p>
        ) : !hasTracks ? (
          <p className="mplayer-hint" role="status">
            未找到音频文件。在仓库根目录创建 <code>music</code> 文件夹，放入你的音乐后刷新页面（支持
            mp3、m4a、flac、ogg 等常见格式）。
          </p>
        ) : null}
        {hasTracks ? (
        <div className="mplayer-now-body">
          <div className="mplayer-now-upper">
            <div className="mplayer-art" aria-hidden />
            <p className="mplayer-track">{cur?.title ?? "—"}</p>
            <p className="mplayer-artist">{cur?.filename ?? "本地文件"}</p>
            <div className="mplayer-transport" role="group" aria-label="播放控制">
              <button
                type="button"
                className="music-ctrl-btn"
                aria-label="上一曲"
                disabled={!hasTracks}
                onClick={goPrev}
              >
                <SkipBack size={22} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="music-ctrl-btn music-ctrl-btn--main"
                aria-label={playing ? "暂停" : "播放"}
                aria-pressed={playing}
                disabled={!hasTracks}
                onClick={togglePlay}
              >
                {playing ? (
                  <Pause size={24} strokeWidth={2.4} fill="currentColor" />
                ) : (
                  <Play size={24} strokeWidth={2.2} fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                className="music-ctrl-btn"
                aria-label="下一曲"
                disabled={!hasTracks}
                onClick={goNext}
              >
                <SkipForward size={22} strokeWidth={2.2} />
              </button>
            </div>
            <div
              ref={scrubRef}
              className="mplayer-scrub"
              role="slider"
              tabIndex={0}
              aria-label="播放进度"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration) || 0}
              aria-valuenow={Math.floor(currentTime)}
              aria-disabled={!hasTracks}
              onClick={(e) => {
                if (scrubRef.current) seekFromBarEvent(e, scrubRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                nudgeBySeconds(e.key === "ArrowLeft" ? -5 : 5);
              }}
            >
              <div
                className="mplayer-scrub-inner"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mplayer-time-row">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="mplayer-now-list-area">
            <h2 className="mplayer-list-title">
              <ListMusic size={15} className="mplayer-list-title-icon" aria-hidden />
              播放列表
            </h2>
            <ol className="mplayer-list" role="list" aria-label="播放列表">
              {tracks.map((t, i) => (
                <li key={t.filename} role="listitem">
                  <button
                    type="button"
                    className={
                      "mplayer-list-item" + (i === activeI ? " mplayer-list-item--active" : "")
                    }
                    onClick={() => {
                      if (i === activeI) {
                        void togglePlay();
                      } else {
                        setActiveI(i);
                      }
                    }}
                  >
                    <span>{t.title}</span>
                    <span className="mplayer-list-meta">
                      {i === activeI ? (playing ? "播放中" : "已选") : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
