import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MusicPlaybackProvider } from "./MusicPlaybackProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MusicPlaybackProvider>
      <App />
    </MusicPlaybackProvider>
  </StrictMode>
);
