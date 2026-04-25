# 隅言 / Nooktalk

一个论坛首页原型项目：

- 前端：React + Vite
- 后端（天气接口）：FastAPI
- 日历：公历 + 农历（`lunar`）
- 天气：高德地图 Web 服务 API（实时天气 + IP 定位）

---

## 目录结构

```txt
Nooktalk/
  api/                 # Python 天气 API
    main.py
    amap_weather.py
  public/
    weather/           # 天气图标资源
  src/
    App.jsx            # 主界面（含天气卡、农历日历）
    App.css
  requirements.txt     # Python 依赖
  package.json         # Node 依赖
```

---

## 环境要求

- Node.js 18+（建议最新 LTS）
- Python 3.10+

---

## 安装依赖

### 1) 前端依赖

```bash
npm install
```

### 2) 后端依赖

```bash
pip install -r requirements.txt
```

---

## 环境变量

在项目根目录创建 `.env`（仓库已忽略该文件）：

```env
AMAP_KEY=你的高德Web服务Key
# 可选：默认行政区 adcode（本地/内网 IP 场景会用到）
# AMAP_DEFAULT_ADCODE=110000
```

可参考 `.env.example`。

---

## 启动项目

需要分别启动后端和前端（两个终端）。

### 终端 A：启动天气 API

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 5055
```

健康检查：

```bash
curl http://127.0.0.1:5055/api/health
```

### 终端 B：启动前端

```bash
npm run dev
```

浏览器打开 Vite 输出地址（通常 `http://localhost:5173`）。

> 开发环境中，Vite 已配置 `/api` 代理到 `http://127.0.0.1:5055`。

---

## 主要功能

- 三栏 Bento 风格首页布局
- 右栏数字时钟
- 日历显示公历 + 农历日
- 左下天气卡（位置、天气、温度、湿度）
- 社交链接卡片（GitHub / 哔哩哔哩 / 小红书 / Gmail）

---

## 常见问题

### 1) 天气显示“暂不可用”

请检查：

1. 后端是否已启动（`/api/health` 返回 `{"status":"ok"}`）
2. `.env` 是否配置了有效 `AMAP_KEY`
3. 当前网络是否可访问高德接口

### 2) 本地开发时看不到天气请求

确认你是通过 `npm run dev` 打开的前端页面，并且 `vite.config.js` 里的 `/api` 代理未被修改。

---

## 安全提示

- 不要把真实 `AMAP_KEY` 提交到 Git 仓库。
- 若 Key 已泄露，请在高德控制台立即重置。

## React + Vite 模板说明

该模板提供了一个最小可用配置，让 React 在 Vite 中运行，并内置 HMR（热更新）与基础 ESLint 规则。

当前可用的两个官方插件：

- `[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react)`：基于 [Oxc](https://oxc.rs)
- `[@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)`：基于 [SWC](https://swc.rs/)

### React Compiler

该模板默认未启用 React Compiler，因为它会对开发与构建性能产生一定影响。  
如需启用，请参考[官方文档](https://react.dev/learn/react-compiler/installation)。

### 扩展 ESLint 配置

如果你要开发生产级应用，建议使用 TypeScript 并启用带类型信息的 lint 规则。  
可参考 [TS 模板](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) 了解如何集成 TypeScript 与 `[typescript-eslint](https://typescript-eslint.io)`。