import { lazy, Suspense } from "react";
import { useDeviceProfile } from "./hooks/useDeviceProfile.js";

const DesktopApp = lazy(() => import("./App.jsx"));
const MobileApp = lazy(() => import("./mobile/MobileApp.jsx"));

function ShellFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#3a4a40",
      }}
    >
      加载中…
    </div>
  );
}

export default function DeviceRouter() {
  const { isMobile } = useDeviceProfile();

  return (
    <Suspense fallback={<ShellFallback />}>
      {isMobile ? <MobileApp /> : <DesktopApp />}
    </Suspense>
  );
}
