#!/usr/bin/env bash
# 在服务器上以 root 执行：安装依赖、拉代码、构建、配置 systemd 与 Nginx
# 支持：CentOS Stream 9 / RHEL 8+ 系（dnf）、Debian / Ubuntu（apt）
# 使用：bash scripts/bootstrap-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nooktalk}"
REPO_URL="${REPO_URL:-https://github.com/chatutuaaaa/Nooktalk.git}"
NODE_MAJOR="${NODE_MAJOR:-22}"

# ---------- 检测发行版 ----------
if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
else
  echo "无法读取 /etc/os-release" >&2
  exit 1
fi

ID_LIKE_STR="${ID_LIKE:-}"
PKG=""
if { [[ "$ID" == "debian" ]] || [[ "$ID" == "ubuntu" ]]; } || [[ "$ID_LIKE_STR" == *"debian"* ]]; then
  PKG=deb
elif { [[ "$ID" == "centos" ]] || [[ "$ID" == "rhel" ]] || [[ "$ID" == "fedora" ]]; } || \
     { [[ "$ID" == "rocky" ]] || [[ "$ID" == "almalinux" ]]; } || \
     [[ "$ID_LIKE_STR" == *"rhel"* ]] || [[ "$ID_LIKE_STR" == *"fedora"* ]]; then
  PKG=rhel
else
  echo "未识别的系统: ID=$ID ID_LIKE=$ID_LIKE_STR" >&2
  echo "请使用 CentOS Stream / RHEL / Fedora 系 或 Debian / Ubuntu" >&2
  exit 1
fi

echo "==> 发行版: $PRETTY_NAME (包管理: $PKG)"
echo "==> 部署目录: $APP_DIR"

# ---------- 运行 Web/ API 的 Linux 用户（RHEL 无 www-data，一般为 nginx）----------
resolve_app_user() {
  if getent passwd www-data &>/dev/null; then
    APP_USER=www-data
    APP_GROUP=www-data
  elif getent passwd nginx &>/dev/null; then
    APP_USER=nginx
    APP_GROUP=nginx
  else
    if ! getent passwd nooktalk &>/dev/null; then
      useradd -r -M -c "Nooktalk" -d "$APP_DIR" -s /sbin/nologin nooktalk 2>/dev/null || true
    fi
    if getent passwd nooktalk &>/dev/null; then
      APP_USER=nooktalk
      APP_GROUP=nooktalk
    else
      echo "无法解析运行用户" >&2
      exit 1
    fi
  fi
}

# ---------- 安装包（RHEL: dnf；Debian: apt）----------
install_packages_rhel() {
  dnf install -y \
    ca-certificates curl git \
    python3 python3-pip \
    nginx
}

install_packages_deb() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    python3 python3-venv python3-pip \
    nginx
}

install_node_rhel() {
  local ver="$1"
  if command -v node &>/dev/null; then
    local maj
    maj=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
    if [ "$maj" -ge 18 ] 2>/dev/null; then
      return 0
    fi
  fi
  echo "==> 安装 Node.js ${ver}.x（NodeSource RPM）"
  curl -fsSL "https://rpm.nodesource.com/setup_${ver}.x" | bash -
  dnf install -y nodejs
}

install_node_deb() {
  local ver="$1"
  if command -v node &>/dev/null; then
    local maj
    maj=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
    if [ "$maj" -ge 18 ] 2>/dev/null; then
      return 0
    fi
  fi
  echo "==> 安装 Node.js ${ver}.x（NodeSource deb）"
  curl -fsSL "https://deb.nodesource.com/setup_${ver}.x" | bash -
  apt-get install -y nodejs
}

if [ "$PKG" = rhel ]; then
  install_packages_rhel
  install_node_rhel "$NODE_MAJOR"
else
  install_packages_deb
  install_node_deb "$NODE_MAJOR"
fi
resolve_app_user

node -v
npm -v
echo "==> 运行用户: $APP_USER:$APP_GROUP"

# ---------- 拉代码 ----------
# 若上次部署已将 $APP_DIR chown 给 $APP_USER，root 再 pull 会报 dubious ownership。
# 注意：仅 git -c 无效，pull 会起子进程且不继承 -c，需写入 global（部署机 root 上一条即可，已存在则跳过）
ensure_git_safe_directory() {
  if git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$APP_DIR" 2>/dev/null; then
    return 0
  fi
  git config --global --add safe.directory "$APP_DIR"
}
if [ -d "$APP_DIR/.git" ]; then
  echo "==> 已有仓库，git pull"
  ensure_git_safe_directory
  git -C "$APP_DIR" pull --ff-only
else
  if [ -e "$APP_DIR" ]; then
    echo "错误: $APP_DIR 已存在且不是本仓库。请设 APP_DIR 或删除后重试。" >&2
    exit 1
  fi
  parent=$(dirname "$APP_DIR")
  mkdir -p "$parent"
  echo "==> 克隆 $REPO_URL -> $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ---------- Python 虚拟环境 ----------
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
. .venv/bin/activate
pip install -U pip
pip install -r requirements.txt

# ---------- 环境变量 ----------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    echo "AMAP_KEY=" > .env
  fi
  chmod 640 .env
  echo "!!! 请编辑 $APP_DIR/.env 填入 AMAP_KEY： nano $APP_DIR/.env"
fi

# ---------- 音乐目录 ----------
mkdir -p music
touch music/.gitkeep 2>/dev/null || true

# ---------- 前端构建 ----------
npm ci
npm run build

# ---------- 权限 ----------
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
chmod 750 "$APP_DIR" 2>/dev/null || true
chmod 640 "$APP_DIR/.env" 2>/dev/null || true

# ---------- 写入 systemd（按当前运行用户）----------
write_systemd_unit() {
  cat > /etc/systemd/system/nooktalk-api.service <<SVUNIT
[Unit]
Description=Nooktalk FastAPI (weather + local music)
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$APP_DIR/.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 5055
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
SVUNIT
}
write_systemd_unit
systemctl daemon-reload
systemctl enable nooktalk-api
systemctl restart nooktalk-api
systemctl --no-pager -l status nooktalk-api || true

# ---------- Nginx 站点（有证书则 HTTPS，否则先 HTTP）----------
# shellcheck source=ssl-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/ssl-common.sh"
mkdir -p "$APP_DIR/deploy/ssl"
USE_HTTPS=0
if ssl_certs_ready "$APP_DIR"; then
  install_ssl_files_for_app "$APP_DIR"
  USE_HTTPS=1
  open_firewall_https "$PKG"
else
  echo "!!! 未在 $APP_DIR/deploy/ssl/ 发现证书，Nginx 暂用 HTTP。"
  echo "!!! 上传 www.nooktalk.top.pem / .key 后执行: sudo bash $APP_DIR/scripts/install-ssl.sh"
fi
copy_nginx_site_config "$APP_DIR" "$USE_HTTPS" "$PKG"

# ---------- SELinux（RHEL 系：Nginx 反代本机 5055 需打开布尔值）----------
if command -v getenforce &>/dev/null && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  if command -v setsebool &>/dev/null; then
    setsebool -P httpd_can_network_connect 1 || true
    echo "==> 已设 SELinux: httpd_can_network_connect=1（便于 /api/ 反代）"
  fi
fi

# ---------- firewalld：放行 HTTP（HTTPS 在启用证书时由 open_firewall_https 处理）----------
if [ "$PKG" = rhel ] && systemctl is-active --quiet firewalld 2>/dev/null; then
  if firewall-cmd --permanent --add-service=http --zone=public 2>/dev/null; then
    :
  else
    firewall-cmd --permanent --add-service=http || true
  fi
  if [ "$USE_HTTPS" = "1" ]; then
    firewall-cmd --permanent --add-service=https --zone=public 2>/dev/null \
      || firewall-cmd --permanent --add-service=https || true
  fi
  firewall-cmd --reload
  echo "==> firewalld 已放行 http$([ "$USE_HTTPS" = 1 ] && echo " 与 https")"
fi

systemctl enable nginx 2>/dev/null || true
nginx -t
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl reload nginx
else
  systemctl start nginx
fi

echo ""
echo "==> 改 .env 后执行: systemctl restart nooktalk-api"
if [ "$USE_HTTPS" = "1" ]; then
  echo "==> 访问: https://www.nooktalk.top/"
else
  echo "==> 访问: http://$(hostname -I 2>/dev/null | awk '{print $1}')/  （装好证书后改 https）"
fi
echo "==> 本机: curl -sS http://127.0.0.1:5055/api/health"
echo "==> 云厂商安全组需放行 80、443（启用 HTTPS 时）"
