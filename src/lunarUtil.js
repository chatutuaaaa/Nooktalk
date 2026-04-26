import { formatLunarParts, toLunar } from "lunar";

const LUNAR_TZ = { timezone: "Asia/Shanghai" };

export function getLunarDayLabel(gregorianYear, monthIndex0, day) {
  try {
    const { lunar } = toLunar(
      { year: gregorianYear, month: monthIndex0 + 1, day },
      LUNAR_TZ,
    );
    const parts = formatLunarParts(lunar, { prefix: false, stemBranch: false });
    const d = parts.find((p) => p.type === "day");
    return d?.value ?? "";
  } catch {
    return "";
  }
}

export function getLunarMonthTitle(gregorianYear, monthIndex0) {
  try {
    const { lunar } = toLunar(
      { year: gregorianYear, month: monthIndex0 + 1, day: 15 },
      LUNAR_TZ,
    );
    const parts = formatLunarParts(lunar, { prefix: "农历" });
    return parts
      .filter((p) => p.type !== "day")
      .map((p) => p.value)
      .join("");
  } catch {
    return "";
  }
}
