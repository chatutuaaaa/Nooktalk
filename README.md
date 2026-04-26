# 隅言 / Nooktalk

基于 React + Vite 的「探索」首页，以及日程日历、周天气、时间工具、本地音乐播放等子页；天气与本地曲库由 FastAPI 提供。

- **前端**：React + Vite
- **后端**：FastAPI（天气 + 本地 `music/` 列目录与流式播放）
- **日历**：公历 + 农历（`lunarUtil` 等）
- **天气**：高德 Web 服务（实时天气、预报、IP 区划）

---

## 目录结构（节选）

```txt
Nooktalk/
  api/
    main.py            # 路由：健康检查、天气、音乐
    amap_weather.py      # 高德：IP 定位、实况、预报
    music_routes.py     # 本地 music/ 列目录与按文件名流式传输
  music/                # 本地音频目录（除 .gitkeep 外已 .gitignore）
  public/weather/       # 天气 SVG 图标
  src/
    App.jsx / App.css   # 三栏 Bento、导航与子页出口
    MusicPlayer.jsx     # 音乐子页
    MusicPlaybackProvider.jsx
    ScheduleCalendar.jsx
    WeatherWeek.jsx
    TimeTools.jsx
    …
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
# 可选：非公网/本地回环时默认行政区
# AMAP_DEFAULT_ADCODE=110000
```

以 `.env.example` 为模板。不要把真实 Key 推送到仓库；泄露后在 [高德控制台](https://console.amap.com/) 重置 Key。

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

**终端 B — 前端**

```bash
npm run dev
```

浏览器打开终端里提示的地址（一般为 `http://localhost:5173`）。  
开发时 Vite 将 **`/api` 代理到** `http://127.0.0.1:5055`，故前端能直接请求天气与音乐接口。

**本地音乐**：把 `mp3`、`flac`、`ogg` 等文件放入根目录的 **`music/`** 后刷新音乐页与首页小卡；该目录下除 `music/.gitkeep` 外其余文件**不会**被 Git 跟踪。

---

## 主要功能

- 三栏 Bento：侧栏（导航 + 天气小卡）/ 主内容 / 右侧（主界面含时钟、月历、音乐小卡等）
- **日程与日历**（月/年）：本地日程存储、农历提示、子页与左栏底对齐等布局
- **未来天气**子页、**时间工具**子页
- **音乐**：从 `music/` 经 API 拉取列表、HTML5 音频播放、首页与音乐页**共享**播放状态

---

## 脚本

| 命令            | 说明         |
| --------------- | ------------ |
| `npm run dev`   | 开发 + HMR   |
| `npm run build` | 生产构建     |
| `npm run preview` | 预览构建结果 |
| `npm run lint`  | ESLint       |

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

## 服务器部署（Ubuntu / Debian）

> **安全**：公网服务器请勿在聊天/工单里发 root 密码；用 SSH 公钥登录、禁用 root 密码。若已泄露密码，请立即在提供商控制台**修改密码**并启用密钥。

1. 本机或跳板机用 SSH 登录（**交互输入密码**或使用密钥，勿把密码写进命令行）  
   `ssh root@<服务器IP>`

2. 在服务器上二选一拉代码并跑一键脚本：  
   **方式 A（推荐，仓库已 public）**  
   ```bash
   curl -fsSL https://raw.githubusercontent.com/chatutuaaaa/Nooktalk/main/scripts/bootstrap-server.sh -o /tmp/nook-bootstrap.sh
   bash /tmp/nook-bootstrap.sh
   ```  
   **方式 B**  
   ```bash
   apt-get update && apt-get install -y git
   git clone https://github.com/chatutuaaaa/Nooktalk.git /var/www/nooktalk
   bash /var/www/nooktalk/scripts/bootstrap-server.sh
   ```

3. 脚本会安装 `nginx`、通过 NodeSource 装 Node 20+、建 venv、拉依赖、`npm run build`、写 `systemd` 单元 `nooktalk-api`、配置 Nginx 站点。  
   环境变量：首次会在 `/var/www/nooktalk/.env` 创建占位，请执行：  
   `nano /var/www/nooktalk/.env` 填好 `AMAP_KEY`，再 `systemctl restart nooktalk-api`  
   本地曲库：把音乐文件 scp 到 `/var/www/nooktalk/music/` 并 `chown -R www-data:www-data /var/www/nooktalk/music`（脚本已建目录）。

4. 访问 `http://<服务器公网IP>/` ；`curl -sS http://127.0.0.1:5055/api/health` 在服务器上应返回 `ok`。

- 可改环境变量 `APP_DIR`、`REPO_URL` 重跑或换目录。  
- 静态资源目录：`/var/www/nooktalk/dist`；API 经 Nginx 走 `/api/`。  
- 若 `bootstrap-server.sh` 尚未推送到 `main`，请用方式 B 或先 `git pull` 再执行仓库内脚本。

---

## 技术栈备注

- 模板级说明（React 插件、React Compiler、TS + ESLint 扩展）可参见 [Vite 官方 create-react 文档](https://vitejs.dev/)；当前仓库为 JS + 既有 ESLint 配置，按需再接入 TypeScript 即可。
