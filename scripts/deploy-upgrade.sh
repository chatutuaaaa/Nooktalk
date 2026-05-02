#!/usr/bin/env bash
# 升级已有 Nooktalk 部署：拉最新代码、更新 Python/Node 依赖、重新构建前端、重启 API 与 Nginx。
# 不会删除或覆盖 .env、不会动 PostgreSQL 数据目录；启动时由应用执行 create_all / ensure_community_columns 做列级迁移。
#
# 用法（在服务器上，建议 root 或有 sudo）：
#   sudo bash /var/www/nooktalk/scripts/deploy-upgrade.sh
# 或指定目录：
#   sudo APP_DIR=/opt/nooktalk bash /opt/nooktalk/scripts/deploy-upgrade.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nooktalk}"
cd "$APP_DIR"

ensure_git_safe_directory() {
  if git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$APP_DIR" 2>/dev/null; then
    return 0
  fi
  git config --global --add safe.directory "$APP_DIR"
}

if [ ! -d .git ]; then
  echo "错误: $APP_DIR 不是 git 仓库，请先 clone 或运行 scripts/bootstrap-server.sh" >&2
  exit 1
fi

ensure_git_safe_directory
echo "==> git pull --ff-only"
git pull --ff-only

if [ ! -d .venv ]; then
  echo "错误: 未找到 $APP_DIR/.venv，请先运行 scripts/bootstrap-server.sh 完成首次部署" >&2
  exit 1
fi

# shellcheck source=/dev/null
. .venv/bin/activate
echo "==> pip install -r requirements.txt"
pip install -U pip
pip install -r requirements.txt

echo "==> npm ci && npm run build"
npm ci
npm run build

APP_USER=""
APP_GROUP=""
if systemctl show nooktalk-api &>/dev/null; then
  APP_USER=$(systemctl show nooktalk-api -p User --value 2>/dev/null || true)
  APP_GROUP=$(systemctl show nooktalk-api -p Group --value 2>/dev/null || true)
fi
if [ -n "${APP_USER:-}" ]; then
  [ -n "${APP_GROUP:-}" ] || APP_GROUP="$APP_USER"
  echo "==> chown -R $APP_USER:$APP_GROUP $APP_DIR"
  chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
  chmod 640 "$APP_DIR/.env" 2>/dev/null || true
else
  echo "!!! 未找到 systemd 单元 nooktalk-api，跳过 chown（若首次部署请跑 bootstrap-server.sh）"
fi

if [ -f "$APP_DIR/scripts/restart-nooktalk.sh" ]; then
  echo "==> restart-nooktalk.sh"
  bash "$APP_DIR/scripts/restart-nooktalk.sh"
else
  echo "==> systemctl restart nooktalk-api && nginx reload"
  systemctl restart nooktalk-api
  nginx -t && systemctl reload nginx
fi

echo ""
echo "==> 本机自检: curl -sS http://127.0.0.1:5055/api/health"
echo "==> 完成（数据库与 .env 未改动；新列由应用启动时自动 ALTER）"
