# 隅言 / Nooktalk

基于 React + Vite 的「探索」首页，以及日程日历、**帖子广场**、周天气、时间工具、本地音乐播放等子页；天气与本地曲库由 FastAPI 提供。账号、日程与帖子等数据可接入 **PostgreSQL**（本地可用 Podman 等跑数据库）。

- **前端**：React + Vite
- **后端**：FastAPI（天气、音乐、**注册/登录（JWT）**、**帖子/评论/点赞/日程** 等）
- **日历**：公历 + 农历（`lunarUtil` 等）；登录用户日程存数据库，访客仍可用浏览器本地
- **社区**：帖子列表与详情、分类与话题标签、**Markdown** 发布（`@toast-ui/editor`）、真实浏览/点赞/评论
- **天气**：高德 Web 服务（实时天气、预报、IP 区划）

前端帖子相关路由与浏览器地址栏一致，**刷新不丢状态**：例如 `/posts`、`/posts/new`（发帖）、`/posts/123`（详情）。更完整的产品与后台规划见仓库根目录 `ISSUE.md`（可选阅读）。

---

## 目录结构（节选）

```txt
Nooktalk/
  api/
    main.py            # 入口：健康检查、CORS、挂载各路由、启动时建表
    amap_weather.py    # 高德：IP 定位、实况、预报
    music_routes.py    # 本地 music/ 列目录与流式播放
    db.py              # SQLAlchemy 引擎与会话
    models.py          # User / ScheduleEvent / Post / 点赞与评论 等
    security.py        # 密码哈希、JWT
    auth_routes.py     # 注册、登录、当前用户
    schedule_routes.py # 登录用户日程 CRUD
    post_routes.py     # 帖子列表、详情、点赞、评论
  music/                # 本地音频（除 .gitkeep 外已 .gitignore）
  public/weather/       # 天气 SVG 图标
  src/
    App.jsx / App.css   # 三栏 Bento、导航、帖子广场等
    MusicPlayer.jsx
    ScheduleCalendar.jsx
    WeatherWeek.jsx
    TimeTools.jsx
    assets/            # 帖子统计等 UI 图标（SVG）
  deploy/               # Nginx 模板、systemd 单元说明等
  scripts/              # 服务器引导、一键重载 Nginx+API
  .env.example
  requirements.txt
  package.json
  vite.config.js        # 开发时 /api 代理到 5055
```

---

## 环境要求

- Node.js 18+（建议 LTS）
- Python 3.10+

---

## 安装依赖

**前端**

```bash
npm install
```

**后端**

```bash
pip install -r requirements.txt
```

---

## 环境变量

在**项目根目录**创建 `.env`（已被 Git 忽略，勿提交）：

```env
AMAP_KEY=你的高德Web服务Key
# 本地 PostgreSQL 示例（按你的实际库名/用户/密码调整）
# DATABASE_URL=postgresql+psycopg://user:pass@127.0.0.1:5432/nooktalk
# JWT_SECRET=请换成长随机串
# 可选：非公网/本地回环时默认行政区
# AMAP_DEFAULT_ADCODE=110000
```

以 `.env.example` 为模板。不要把真实 Key、数据库口令、`JWT_SECRET` 推送到仓库；高德 Key 泄露后在 [高德控制台](https://console.amap.com/) 重置。

**本地数据库**：可用 Podman / Docker 跑 PostgreSQL，再填好 `DATABASE_URL`；不配数据库时，仅依赖数据库的功能（注册登录、帖子、绑定日程等）将不可用，天气与音乐仍可单独调试。

---

## 启动项目

需**两个终端**分别跑后端与前端。

**终端 A — API（天气 + 音乐）**

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 5055
```

- 健康检查：`GET /api/health`
- 天气：`GET /api/weather`、`GET /api/weather/forecast`
- 曲库列表：`GET /api/music/tracks`（扫描项目根下 `music/` 中的音频）
- 播放流：`GET /api/music/stream/<filename>`（仅允许已登记扩展名，且防止路径穿越）
- 认证（需数据库与 `JWT_SECRET`）：`POST /api/register`、`POST /api/login`、`GET /api/me` 等
- 日程（需登录）：`GET/POST/DELETE /api/events` 等
- 帖子：公开 `GET /api/posts`、`GET /api/posts/{id}`；登录 `POST /api/posts`；`POST/DELETE /api/posts/{id}/like`；`POST /api/posts/{id}/comments` 等

**终端 B — 前端**

```bash
npm run dev
```

浏览器打开终端里提示的地址（一般为 `http://localhost:5173`）。  
开发时 Vite 将 `**/api` 代理到** `http://127.0.0.1:5055`，故前端能直接请求天气与音乐接口。

**本地音乐**：把 `mp3`、`flac`、`ogg` 等文件放入根目录的 `**music/`** 后刷新音乐页与首页小卡；该目录下除 `music/.gitkeep` 外其余文件**不会**被 Git 跟踪。

---

## 主要功能

- 三栏 Bento：侧栏（导航 + 天气小卡）/ 主内容 / 右侧（主界面含时钟、月历、音乐小卡等）
- **帖子广场**：公开浏览；登录后发帖（富文本/Markdown 存储）、分类与话题、详情页点赞与评论、浏览量；发帖可用全宽编辑页，地址 `/posts/new`
- **作品中心**：我的帖子列表、软删除列表切换、卡片内编辑/删除/恢复（删除后 30 天内可恢复）；编辑复用发帖页，返回路径保持来源页
- **最新讨论**：独立子页，按发帖时间倒序；支持分页（上一页/下一页）
- **管理后台**：全站统计、用户禁言/解封、分项数据视图、搜索筛选与时间戳展示
- **日程与日历**（月/年）：登录用户日程与账号绑定存 PostgreSQL；访客仍用本地；农历提示、子页与左栏底对齐等布局
- **未来天气**子页、**时间工具**子页
- **音乐**：从 `music/` 经 API 拉取列表、HTML5 音频播放、首页与音乐页**共享**播放状态

---

## 脚本


| 命令                | 说明       |
| ----------------- | -------- |
| `npm run dev`     | 开发 + HMR |
| `npm run build`   | 生产构建     |
| `npm run preview` | 预览构建结果   |
| `npm run lint`    | ESLint   |
| `bash scripts/restart-nooktalk.sh` | 服务器一键重载 nginx 并重启 API |
| `bash scripts/stop-nooktalk.sh` | 服务器一键停止 nginx 与 API |


---

## 常见问题

**天气「暂不可用」**  

1. 后端已启动且 `GET /api/health` 正常
2. `.env` 中 `AMAP_KEY` 有效、高德已开通** Web 服务**
3. 用 `npm run dev` 打开页面，且未改掉 `vite.config.js` 里对 `/api` 的代理

**曲库始终为空**  

1. 已运行 uvicorn，且 `music/` 在**仓库根目录**、内有支持的音频扩展名
2. 用浏览器或 `curl` 试 `http://127.0.0.1:5055/api/music/tracks`

**生产环境**  
需自行部署前端静态资源，并将 `/api` 指到实际 API 服务；CORS 可通过环境变量 `CORS_ORIGINS` 在 `api/main.py` 中配置（默认较宽松，生产可收紧）。  
下面「服务器部署」为推荐的一种方式（Nginx 静态 + 反代 API + systemd 跑 Uvicorn）。

---

## 服务器部署（CentOS Stream / RHEL 系 或 Ubuntu / Debian）

> **安全**：公网服务器请勿在聊天/工单里发 root 密码；用 SSH 公钥登录、禁用 root 密码。若已泄露密码，请立即在提供商控制台**修改密码**并启用密钥。

1. 本机或跳板机用 SSH 登录（**交互输入密码**或使用密钥，勿把密码写进命令行）
  `ssh root@<服务器IP>`
2. 在服务器上二选一拉代码并跑一键脚本：
  **方式 A（推荐，仓库已 public）**  
   **方式 B**（先只装 `git` 再克隆并执行仓库内脚本；包管理因系统而异）  
   **CentOS Stream / RHEL 系**  
   **Debian / Ubuntu**  
3. 脚本会安装 `nginx`、通过 NodeSource 装 Node 18+（默认 22 系）、`python3` venv、拉依赖、`npm run build`、写入 **systemd** 单元 `nooktalk-api`、并配置 Nginx 站点。
  - RHEL 系：站点写在 `/etc/nginx/conf.d/nooktalk.conf`；若 **SELinux** 为 Enforcing 会设 `httpd_can_network_connect` 以便 Nginx 反代本机 API；若 **firewalld** 在跑会放行 `http`。**请确认云安全组也放行 80 端口。**  
  - 环境变量：首次会在 `/var/www/nooktalk/.env` 创建占位，请 `nano /var/www/nooktalk/.env` 填好 `AMAP_KEY` 后 `systemctl restart nooktalk-api`。  
  - 本地曲库：把音乐文件 scp 到 `/var/www/nooktalk/music/`，将目录属主与运行用户一致（Debian 系多为 `www-data`，RHEL 系经脚本多为 `nginx`），例如 `chown -R nginx:nginx /var/www/nooktalk/music` 或 `chown -R www-data:www-data /var/www/nooktalk/music`（脚本已建目录，并在收尾对整站做了 `chown`）。
4. 访问 `http://<服务器公网IP>/` ；`curl -sS http://127.0.0.1:5055/api/health` 在服务器上应返回 `ok`。

- 可改环境变量 `APP_DIR`、`REPO_URL`、`NODE_MAJOR` 重跑或换目录/Node 大版本。  
- 改 `.env`、Nginx 或 `git pull` 后需要重启时，可 `sudo bash /var/www/nooktalk/scripts/restart-nooktalk.sh`（`nginx -t`、重载/启动 Nginx、重启 `nooktalk-api`）。  
- 如需停服维护，可执行 `sudo bash /var/www/nooktalk/scripts/stop-nooktalk.sh` 一键停止。  
- 静态资源目录：`/var/www/nooktalk/dist`；API 经 Nginx 走 `/api/`。  
- 若 `bootstrap-server.sh` 尚未推送到 `main`，请用方式 B 或先 `git pull` 再执行仓库内脚本。  
- 实际生效的 `nooktalk-api.service` 由 `bootstrap-server.sh` 写入；仓库里 `deploy/nooktalk-api.service` 仅作参考，运行用户以脚本解析为准（RHEL 多为 `nginx`）。

---

## 技术栈备注

- 模板级说明（React 插件、React Compiler、TS + ESLint 扩展）可参见 [Vite 官方 create-react 文档](https://vitejs.dev/)；当前仓库为 JS + 既有 ESLint 配置，按需再接入 TypeScript 即可。

