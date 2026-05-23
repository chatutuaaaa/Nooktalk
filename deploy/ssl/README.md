# SSL 证书（勿提交私钥到 Git）

从证书商下载的 **Nginx** 包解压后，应包含：

- `www.nooktalk.top.pem`（证书）
- `www.nooktalk.top.key`（私钥）

## 上传到服务器

在**本机**（例如 Windows 上已解压到 `E:\证书`）执行，将 `<服务器IP>` 换成你的公网 IP 或域名：

```bash
scp E:/证书/www.nooktalk.top.pem root@<服务器IP>:/var/www/nooktalk/deploy/ssl/
scp E:/证书/www.nooktalk.top.key root@<服务器IP>:/var/www/nooktalk/deploy/ssl/
```

若证书在 zip 里，先解压 `*_nginx.zip` 再 scp 上述两个文件。

## 在服务器上启用 HTTPS

```bash
sudo bash /var/www/nooktalk/scripts/install-ssl.sh
```

脚本会把证书安装到 `/etc/nginx/ssl/nooktalk/`，切换 Nginx 为 HTTPS 配置，并尝试放行防火墙 443。

**云厂商安全组**需同时放行 **80** 与 **443**。
