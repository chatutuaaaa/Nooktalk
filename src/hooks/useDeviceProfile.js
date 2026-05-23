import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT_PX = 768;

function readShellOverride() {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("shell");
  if (v === "mobile" || v === "desktop") return v;
  return null;
}

function detectIsMobile() {
  const override = readShellOverride();
  if (override === "mobile") return true;
  if (override === "desktop") return false;
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touch = navigator.maxTouchPoints > 0;
  return narrow || (touch && coarse && window.innerWidth <= 900);
}

/**
 * @returns {{ isMobile: boolean, isDesktop: boolean, shell: 'mobile' | 'desktop' }}
 */
export function useDeviceProfile() {
  const [isMobile, setIsMobile] = useState(() => detectIsMobile());

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const onChange = () => setIsMobile(detectIsMobile());
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return {
    isMobile,
    isDesktop: !isMobile,
    shell: isMobile ? "mobile" : "desktop",
  };
}
