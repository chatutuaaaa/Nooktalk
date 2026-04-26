#!/usr/bin/env bash
# 在服务器上改好 Nginx / .env / 代码 后，一键重载 Nginx 并重启 API
# 需 root 或 sudo，例如：sudo bash /var/www/nooktalk/scripts/restart-nooktalk.sh
set -euo pipefail

echo "==> nginx 配置检查"
nginx -t

echo "==> 重载 nginx"
systemctl reload nginx

echo "==> 重启 nooktalk-api"
systemctl restart nooktalk-api
systemctl --no-pager -l status nooktalk-api || true

echo ""
echo "==> 本机自检: curl -sS http://127.0.0.1:5055/api/health"
