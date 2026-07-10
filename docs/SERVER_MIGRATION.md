# HO-Live 服务器迁移手册

本手册用于把当前稳定站点迁移到新服务器。迁移前先合并并固定一个明确的 Git 提交，不要直接在生产目录试验。

## 1. 新服务器要求

- Ubuntu 22.04/24.04 或同级 Linux
- Node.js 20 LTS 或更高版本
- MySQL 8 / 兼容版本
- Nginx
- PM2
- Certbot

建议目录：

```text
/var/www/haiou-live        前端静态文件
/var/www/haiou-api         Node API
/var/backups/ho-live       迁移备份
```

## 2. 旧服务器备份

停写窗口内执行数据库备份，并保存上传文件和环境变量：

```bash
mkdir -p /var/backups/ho-live
mysqldump --single-transaction --routines --triggers haiou_live \
  > /var/backups/ho-live/haiou_live.sql

tar -C /var/www/haiou-live -czf /var/backups/ho-live/uploads.tar.gz uploads
cp /var/www/haiou-api/.env /var/backups/ho-live/haiou-api.env
```

如仍使用本地回放数据，同时备份：

```bash
cp /var/www/haiou-live/assets/data/replays.local.json \
  /var/backups/ho-live/replays.local.json
```

核对文件：

```bash
ls -lh /var/backups/ho-live
sha256sum /var/backups/ho-live/*
```

## 3. 安装代码和依赖

```bash
cd /var/www
git clone https://github.com/imtaka1988-lgtm/HO-Live.git ho-live-release
cd ho-live-release

git checkout <已审核的提交 SHA>

rsync -a --delete haiou-live/ /var/www/haiou-live/
rsync -a --delete haiou-api/ /var/www/haiou-api/
```

安装 API 依赖：

```bash
cd /var/www/haiou-api
npm ci --omit=dev
```

## 4. 环境变量

```bash
cd /var/www/haiou-api
cp .env.example .env
chmod 600 .env
```

生成新的 JWT 密钥：

```bash
openssl rand -hex 48
```

把输出写入 `.env` 的 `JWT_SECRET`。更换密钥后，旧服务器签发的所有登录 token 都会失效，用户、主播和管理员需要重新登录。

至少检查：

```text
JWT_SECRET
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASS
CORS_ORIGIN
CHAT_ALLOWED_ORIGINS
ODDS_API_KEY
```

域名变化时，必须同时修改 `CORS_ORIGIN` 和 `CHAT_ALLOWED_ORIGINS`。

## 5. 恢复数据库并执行迁移

先创建数据库和运行账号，再导入：

```bash
mysql haiou_live < /var/backups/ho-live/haiou_live.sql
```

迁移需要临时拥有 `ALTER`、`CREATE` 和 `INDEX` 权限：

```bash
cd /var/www/haiou-api
npm run migrate
```

迁移完成后，可把 API 运行账号收紧为业务所需的 `SELECT/INSERT/UPDATE/DELETE` 权限。

## 6. 恢复上传文件

```bash
mkdir -p /var/www/haiou-live/uploads
tar -C /var/www/haiou-live -xzf /var/backups/ho-live/uploads.tar.gz
chown -R www-data:www-data /var/www/haiou-live/uploads
find /var/www/haiou-live/uploads -type d -exec chmod 750 {} \;
find /var/www/haiou-live/uploads -type f -exec chmod 640 {} \;
```

确保运行 Node 的账号对 `uploads` 目录有写权限。可通过同一用户组解决，不要开放 `777`。

## 7. 部署前验证

```bash
cd /var/www/haiou-api
npm run verify
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET.length)"
```

JWT 长度必须至少为 32。

启动临时 API 并检查：

```bash
node server.js
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3001/api/health/db
curl -fsS http://127.0.0.1:3001/api/health/tables
curl -fsS http://127.0.0.1:3001/api/public/rooms
curl -fsS http://127.0.0.1:3001/api/schedule
```

## 8. PM2

```bash
cd /var/www/haiou-api
pm2 start server.js --name haiou-api
pm2 save
pm2 startup
```

先保持单实例。当前内存缓存和定时预热是进程级的；需要多实例时，应先把缓存与限流迁移到 Redis，并把预热任务拆成独立 worker。

## 9. Nginx 和证书

复制仓库中的 `nginx/haiou-live.conf`，然后按新服务器实际情况修改：

```text
server_name
root
ssl_certificate
ssl_certificate_key
proxy_pass 端口
```

测试后再加载：

```bash
nginx -t
systemctl reload nginx
```

首次签发证书：

```bash
certbot --nginx -d example.com -d www.example.com
```

不要直接复用旧域名的证书路径。

## 10. 上线冒烟测试

逐项确认：

1. 首页、全部直播、赛程、资讯页面正常。
2. 用户注册和登录正常。
3. 普通用户 token 无法访问 `/api/admin/*`。
4. 管理员重新登录后可管理房间和线路。
5. 主播重新登录后可上传封面和头像。
6. 聊天连接成功，浏览器地址和 Nginx access log 中不再出现 JWT。
7. 赛程“今天”按北京时间显示，场馆和比分可见。
8. 上传新头像后，旧文件会被删除。
9. `pm2 logs haiou-api` 没有持续错误。
10. `df -h`、`free -h`、`iostat` 正常。

## 11. 切换域名

降低 DNS TTL 后再切换 A/AAAA 记录。切换完成后保留旧服务器只读运行一段观察期，不要立即销毁。

## 12. 回退

出现严重问题时：

1. 把 DNS 指回旧服务器。
2. 停止新服务器写入。
3. 保留新服务器日志和数据库快照用于排查。
4. 不要用旧数据库覆盖新数据库，除非已经明确处理迁移期间产生的新数据。

推荐每次上线都记录：

```text
Git 提交 SHA
数据库备份文件及 SHA256
环境变量版本
Nginx 配置版本
上线时间
回退时间点
```
