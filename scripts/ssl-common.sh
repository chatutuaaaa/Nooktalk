# shellcheck shell=bash
# 由 install-ssl.sh / bootstrap-server.sh source，勿直接执行。

SSL_INSTALL_DIR="/etc/nginx/ssl/nooktalk"
SSL_PEM_NAME="www.nooktalk.top.pem"
SSL_KEY_NAME="www.nooktalk.top.key"

ssl_certs_in_deploy_dir() {
  local app_dir="$1"
  [ -f "$app_dir/deploy/ssl/$SSL_PEM_NAME" ] && [ -f "$app_dir/deploy/ssl/$SSL_KEY_NAME" ]
}

ssl_certs_installed_system() {
  [ -f "$SSL_INSTALL_DIR/$SSL_PEM_NAME" ] && [ -f "$SSL_INSTALL_DIR/$SSL_KEY_NAME" ]
}

ssl_certs_ready() {
  ssl_certs_in_deploy_dir "$1" || ssl_certs_installed_system
}

install_ssl_files_from() {
  local src_pem="$1"
  local src_key="$2"
  mkdir -p "$SSL_INSTALL_DIR"
  install -m 644 -o root -g root "$src_pem" "$SSL_INSTALL_DIR/$SSL_PEM_NAME"
  install -m 600 -o root -g root "$src_key" "$SSL_INSTALL_DIR/$SSL_KEY_NAME"
  echo "==> 证书已安装到 $SSL_INSTALL_DIR"
}

install_ssl_files_for_app() {
  local app_dir="$1"
  if ssl_certs_installed_system && ! ssl_certs_in_deploy_dir "$app_dir"; then
    echo "==> 系统目录已有证书，跳过复制"
    return 0
  fi
  if ! ssl_certs_in_deploy_dir "$app_dir"; then
    echo "错误: 未找到 $app_dir/deploy/ssl/$SSL_PEM_NAME 与 $SSL_KEY_NAME" >&2
    echo "请先将证书 scp 到服务器 deploy/ssl/，或设置 SSL_SRC 指向含上述文件的目录。" >&2
    return 1
  fi
  install_ssl_files_from \
    "$app_dir/deploy/ssl/$SSL_PEM_NAME" \
    "$app_dir/deploy/ssl/$SSL_KEY_NAME"
}

copy_nginx_site_config() {
  local app_dir="$1"
  local use_https="$2"
  local pkg="${3:-}"
  local src
  if [ "$use_https" = "1" ]; then
    src="$app_dir/deploy/nginx-nooktalk.conf"
  else
    src="$app_dir/deploy/nginx-nooktalk.http-only.conf"
  fi
  if [ "$pkg" = rhel ]; then
    if [ -f /etc/nginx/conf.d/default.conf ]; then
      mv -f /etc/nginx/conf.d/default.conf "/root/nginx-default.conf.bak.$(date +%s)" 2>/dev/null || true
    fi
    cp -f "$src" /etc/nginx/conf.d/nooktalk.conf
    echo "==> 已写 /etc/nginx/conf.d/nooktalk.conf ($([ "$use_https" = 1 ] && echo HTTPS || echo HTTP))"
  else
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    if [ -e /etc/nginx/sites-enabled/default ]; then
      rm -f /etc/nginx/sites-enabled/default
    fi
    cp -f "$src" /etc/nginx/sites-available/nooktalk
    ln -sf /etc/nginx/sites-available/nooktalk /etc/nginx/sites-enabled/nooktalk
    echo "==> 已写 sites-available/nooktalk ($([ "$use_https" = 1 ] && echo HTTPS || echo HTTP))"
  fi
}

open_firewall_https() {
  local pkg="${1:-}"
  if [ "$pkg" = rhel ] && systemctl is-active --quiet firewalld 2>/dev/null; then
    firewall-cmd --permanent --add-service=https --zone=public 2>/dev/null \
      || firewall-cmd --permanent --add-service=https || true
    firewall-cmd --reload
    echo "==> firewalld 已放行 https (443)"
  fi
  if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 443/tcp || true
    echo "==> ufw 已放行 443/tcp"
  fi
}
