#!/usr/bin/env bash
# 一键停止 Nooktalk 生产服务（nginx + api）
# 用法：sudo bash /var/www/nooktalk/scripts/stop-nooktalk.sh
set -euo pipefail

echo "==> 停止 nooktalk-api"
if systemctl is-active --quiet nooktalk-api 2>/dev/null; then
  systemctl stop nooktalk-api
else
  echo "nooktalk-api 未运行，跳过"
fi

echo "==> 停止 nginx"
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl stop nginx
else
  echo "nginx 未运行，跳过"
fi

echo "==> 当前状态"
systemctl --no-pager -l status nooktalk-api || true
systemctl --no-pager -l status nginx || true
