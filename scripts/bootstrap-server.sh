#!/usr/bin/env bash
# 在服务器上以 root 执行（或 sudo bash bootstrap-server.sh）
# 用途：安装依赖、拉代码、建虚拟环境、构建前端、配置 systemd 与 nginx
# 使用：先 git clone 本仓库，再在仓库内执行，或从本机 scp 本脚本上服务器后执行
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nooktalk}"
REPO_URL="${REPO_URL:-https://github.com/chatutuaaaa/Nooktalk.git}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Nooktalk 部署目标目录: $APP_DIR"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "需要 Debian/Ubuntu 等带 apt-get 的系统" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git \
  python3 python3-venv python3-pip \
  nginx

# Node.js (NodeSource，满足 Vite 对 Node 版本要求)
if ! command -v node >/dev/null 2>&1 || [ "$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)" -lt 18 ] 2>/dev/null; then
  echo "==> 安装 Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

if [ -d "$APP_DIR/.git" ]; then
  echo "==> 已有仓库，git pull"
  git -C "$APP_DIR" pull --ff-only
else
  if [ -e "$APP_DIR" ]; then
    echo "错误: $APP_DIR 已存在且不是本仓库。请设 APP_DIR 或删除该目录后重试。" >&2
    exit 1
  fi
  parent=$(dirname "$APP_DIR")
  mkdir -p "$parent"
  echo "==> 克隆 $REPO_URL -> $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# Python 虚拟环境
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -U pip
pip install -r requirements.txt

# 环境变量：若不存在则建占位（须手动填写 AMAP_KEY）
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    echo "AMAP_KEY=" > .env
  fi
  chmod 640 .env
  echo "!!! 已创建 $APP_DIR/.env ，请立即编辑并填入 AMAP_KEY： nano $APP_DIR/.env"
fi

# 本地音乐目录
mkdir -p music
chown -R www-data:www-data music || true
touch music/.gitkeep 2>/dev/null || true

# 构建前端
npm ci
npm run build

# 权限：运行用户可读代码与 .env
chown -R www-data:www-data "$APP_DIR"
chmod 750 "$APP_DIR"
chmod 640 "$APP_DIR/.env" 2>/dev/null || true

# systemd
cp -f "$APP_DIR/deploy/nooktalk-api.service" /etc/systemd/system/nooktalk-api.service
systemctl daemon-reload
systemctl enable nooktalk-api
systemctl restart nooktalk-api
systemctl --no-pager -l status nooktalk-api || true

# nginx
cp -f "$APP_DIR/deploy/nginx-nooktalk.conf" /etc/nginx/sites-available/nooktalk
if [ ! -L /etc/nginx/sites-enabled/nooktalk ]; then
  ln -sf /etc/nginx/sites-available/nooktalk /etc/nginx/sites-enabled/nooktalk
fi
# 若与 default 冲突，可取消下一行注释
# rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo ""
echo "==> 若修改了 .env，请执行: systemctl restart nooktalk-api"
echo "==> 浏览器访问: http://$(hostname -I | awk '{print $1}')/  或 本机公网 IP"
echo "==> 查看 API: curl -sS http://127.0.0.1:5055/api/health"
