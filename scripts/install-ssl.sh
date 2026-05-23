#!/usr/bin/env bash
# 在服务器上以 root 执行：安装 SSL 证书并切换 Nginx 为 HTTPS。
#
# 用法：
#   sudo bash /var/www/nooktalk/scripts/install-ssl.sh
# 证书默认从 /var/www/nooktalk/deploy/ssl/ 读取；也可指定目录：
#   sudo SSL_SRC=/root/ssl bash /var/www/nooktalk/scripts/install-ssl.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nooktalk}"
SSL_SRC="${SSL_SRC:-}"

# shellcheck source=ssl-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/ssl-common.sh"

if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
fi
ID_LIKE_STR="${ID_LIKE:-}"
PKG=""
if { [[ "${ID:-}" == "debian" ]] || [[ "${ID:-}" == "ubuntu" ]]; } || [[ "$ID_LIKE_STR" == *"debian"* ]]; then
  PKG=deb
elif [[ "${ID_LIKE_STR:-}" == *"rhel"* ]] || [[ "${ID_LIKE_STR:-}" == *"fedora"* ]] || \
     { [[ "${ID:-}" == "centos" ]] || [[ "${ID:-}" == "rhel" ]] || [[ "${ID:-}" == "fedora" ]]; }; then
  PKG=rhel
fi

cd "$APP_DIR"

if [ -n "$SSL_SRC" ]; then
  if [ ! -f "$SSL_SRC/$SSL_PEM_NAME" ] || [ ! -f "$SSL_SRC/$SSL_KEY_NAME" ]; then
    echo "错误: SSL_SRC=$SSL_SRC 中缺少 $SSL_PEM_NAME 或 $SSL_KEY_NAME" >&2
    exit 1
  fi
  mkdir -p "$APP_DIR/deploy/ssl"
  install -m 644 "$SSL_SRC/$SSL_PEM_NAME" "$APP_DIR/deploy/ssl/$SSL_PEM_NAME"
  install -m 600 "$SSL_SRC/$SSL_KEY_NAME" "$APP_DIR/deploy/ssl/$SSL_KEY_NAME"
fi

install_ssl_files_for_app "$APP_DIR"
copy_nginx_site_config "$APP_DIR" 1 "$PKG"
open_firewall_https "$PKG"

echo "==> nginx 配置检查"
nginx -t
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl reload nginx
else
  systemctl start nginx
fi

echo ""
echo "==> HTTPS 已启用: https://www.nooktalk.top/"
echo "==> 自检: curl -sS https://127.0.0.1/api/health -k"
echo "==> 生产建议在 .env 设置: CORS_ORIGINS=https://www.nooktalk.top,https://nooktalk.top"
