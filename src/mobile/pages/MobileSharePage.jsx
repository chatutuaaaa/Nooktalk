import { useMemo, useState } from "react";
import { buildShareSections } from "../../forum/constants.js";
import { absUrlForPathname, homePathname } from "../../routing/paths.js";
import { copyTextToClipboard } from "../../forum/utils.js";

export function MobileSharePage({ onNavigate }) {
  const sections = useMemo(() => buildShareSections(), []);
  const siteUrl = useMemo(() => absUrlForPathname(homePathname()), []);
  const [hint, setHint] = useState("");

  const flash = (msg) => {
    setHint(msg);
    window.setTimeout(() => setHint(""), 2000);
  };

  return (
    <div>
      <section className="m-card">
        <p className="m-section-title">分享本站</p>
        <p className="m-muted" style={{ wordBreak: "break-all" }}>
          {siteUrl}
        </p>
        <div className="m-btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="m-btn m-btn--primary"
            onClick={async () => {
              try {
                await copyTextToClipboard(siteUrl);
                flash("已复制链接");
              } catch {
                flash("复制失败");
              }
            }}
          >
            复制链接
          </button>
          {navigator.share ? (
            <button
              type="button"
              className="m-btn m-btn--ghost"
              onClick={async () => {
                try {
                  await navigator.share({ title: "隅言 Nooktalk", url: siteUrl });
                } catch {
                  // ignore
                }
              }}
            >
              系统分享
            </button>
          ) : null}
        </div>
        {hint ? <p className="m-muted">{hint}</p> : null}
      </section>
      {sections.map((sec) => (
        <section key={sec.title} className="m-card">
          <p className="m-section-title">{sec.title}</p>
          {sec.hint ? <p className="m-muted">{sec.hint}</p> : null}
          {sec.items.map((item) => (
            <div key={item.name} className="m-btn-row" style={{ marginTop: 8, justifyContent: "space-between" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block" }}>{item.name}</strong>
                <span className="m-muted">{item.desc}</span>
              </div>
              {item.external ? (
                <a className="m-btn m-btn--ghost" href={item.url} target="_blank" rel="noopener noreferrer">
                  打开
                </a>
              ) : (
                <button type="button" className="m-btn m-btn--ghost" onClick={() => onNavigate(item.navTarget)}>
                  打开
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
