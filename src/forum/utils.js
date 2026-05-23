export function formatPostTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "时间未知";
  try {
    return new Date(n).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "时间未知";
  }
}

export function avatarFromUsername(username) {
  const seed = encodeURIComponent((username || "nooktalk").trim() || "nooktalk");
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;
}

export function getGreeting(hour) {
  if (hour < 5) return { label: "夜深了" };
  if (hour < 11) return { label: "早上好" };
  if (hour < 14) return { label: "中午好" };
  if (hour < 18) return { label: "下午好" };
  if (hour < 23) return { label: "晚上好" };
  return { label: "晚安" };
}

export function normalizeApiError(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && typeof first.msg === "string") return first.msg;
    return fallback;
  }
  if (typeof detail === "object" && typeof detail.msg === "string") return detail.msg;
  return fallback;
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function fileToResizedJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxSide = 256;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error("无法读取图片尺寸"));
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法处理图片"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("转换失败"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

export function parseTopicsText(text) {
  return Array.from(
    new Set(
      String(text || "")
        .split(/[\s,，]+/)
        .map((t) => t.trim().replace(/^#+/, ""))
        .filter(Boolean)
        .slice(0, 8),
    ),
  );
}
