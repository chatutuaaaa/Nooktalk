import { ScheduleCalendar } from "../../ScheduleCalendar.jsx";
import { WeatherWeek } from "../../WeatherWeek.jsx";
import { TimeTools } from "../../TimeTools.jsx";
import { MusicPlayer } from "../../MusicPlayer.jsx";
import "../MobileApp.css";
import "../../ScheduleCalendar.css";
import "../../WeatherWeek.css";
import "../../TimeTools.css";
import "../../MusicPlayer.css";

export function MobileToolPage({ kind, scheduleScopeKey, authToken }) {
  return (
    <div className="m-tool-embed">
      {kind === "schedule" ? <ScheduleCalendar scheduleScopeKey={scheduleScopeKey} authToken={authToken} /> : null}
      {kind === "weather" ? <WeatherWeek /> : null}
      {kind === "time" ? <TimeTools /> : null}
      {kind === "music" ? <MusicPlayer /> : null}
    </div>
  );
}
