import { useContext } from "react";
import { MusicPlaybackContext } from "./musicPlaybackContext.js";

export function useMusicPlayback() {
  const v = useContext(MusicPlaybackContext);
  if (!v) {
    throw new Error("useMusicPlayback must be used within MusicPlaybackProvider");
  }
  return v;
}
