# ISSUE.md 实施后仍待确认的问题（v1）

实现已覆盖：**软删 / 恢复 / 定时物理删、`is_superuser` / 禁言、帖子与评论点赞、管理端统计与用户禁言**。下列项在需求或部署上仍存在多种合理选择，暂未强行定稿或未完全实现，请你拍板后继续迭代。

---

## 数据库迁移与多环境

- **Alembic 正式迁移**：当前用 `bootstrap_schema.ensure_community_columns` 在无 Alembic 时给 PostgreSQL 补列（开发友好）。生产是否**仅依赖 Alembic**，并下线或弱化 startup `ALTER`？
- **非 PostgreSQL（如 SQLite 本地调试）**：`ensure_community_columns` 会直接跳过；旧库可能没有 `users.is_superuser` 等新列。**是否约束开发只使用 Postgres**，还是补一套 SQLite 迁移 / 明文提示删库重建？

## 产品与权限

- **禁言粒度**：现为布尔 `is_silenced`。是否需要 `silenced_until`（定时解封）、`reason`（用户可见或仅后台）？
- **禁言其他管理员**：当前接口禁止对其他 `is_superuser` 账号禁言。若需要「多级管理员」，需另建角色模型。
- **恢复帖子时单条已删评论**：已按 ISSUE 默认：**仅恢复「随帖级联」的评论**；作者单独删除的评论仍保持隐藏。是否要改为「恢复帖则清空所有子评论的 `deleted_at`」？

## API 与安全

- **ISSUE 建议的 `/api/v1`**：路由仍为无前缀 v1。**是否追加版本前缀**，以及前端 `fetch` base 是否要统一配置？
- **Refresh token / Session**：仍为单 JWT。**是否要上 refresh**，以及登出是否要服务端黑名单？
- **限流**：文档要求登录 / 发帖等限流。**Nginx limit_req 与中间件**，选哪种或都做？

## 运维与后台指标（§11）

- **今日 PV / UV**：未实现浏览事件落库。**是否接入简单 access 日志统计**，还是延后到 v2？
- **ISSUE §11.1「今日点赞总数」「近 7 天活跃」「Top10 热帖」等**：目前后台仅有** totals + 今日新增用户 / 帖子 / 评论**。请列出 v1 **必须上线的指标清单**。
- **热帖榜权重**：仍为前端列表「热门」排序 `view + comment*3 + like*2`。**是否要后台可配置权重**？

## 超级管理员初始化

- **环境变量**：现使用 **`BOOTSTRAP_ADMIN_USERNAME`**，值为用户名或邮箱（不区分大小写）。是否要改为 `BOOTSTRAP_ADMIN_EMAIL` 或支持多个？
- **首次部署**：是否要提供**一次性 CLI**（如 `python -m api.promote_superuser user@example.com`）替代或补充环境变量？

## 其他

- **定时任务形态**：purge 现为进程内 daemon 每小时执行。**是否要改为 systemd timer / Celery / 外部 Cron** 以满足「运维只配一个 job」的书面要求？
- **审计查询接口**：审计写入 `audit_logs`（例如禁言），**是否补充 `GET /api/admin/audit`** 分页查询？
