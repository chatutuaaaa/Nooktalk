import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DeviceRouter from "./DeviceRouter.jsx";
import { MusicPlaybackProvider } from "./MusicPlaybackProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MusicPlaybackProvider>
      <DeviceRouter />
    </MusicPlaybackProvider>
  </StrictMode>
);
