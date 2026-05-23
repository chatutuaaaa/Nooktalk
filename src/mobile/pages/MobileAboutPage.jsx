export function MobileAboutPage() {
  return (
    <div>
      <section className="m-card">
        <p className="m-section-title">关于隅言 / Nooktalk</p>
        <p className="m-muted">
          隅言是一个温柔的中文小站：探索首页、帖子广场、日程日历、天气、音乐与时间工具，以及个人中心与管理后台。
        </p>
        <p className="m-muted" style={{ marginTop: 12 }}>
          移动端与桌面端共用同一套账号与数据；窄屏会自动进入移动界面，也可在地址栏加{" "}
          <code>?shell=desktop</code> 或 <code>?shell=mobile</code> 强制切换。
        </p>
      </section>
    </div>
  );
}
