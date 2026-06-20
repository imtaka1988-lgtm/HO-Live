# 海鸥直播 / HO-Live

> 当前状态：2026-06-20 服务器稳定同步版。以线上服务器 `/var/www` 当前可运行代码为基准；不要再把实验性改动直接拉到生产目录。

## 当前稳定基线

```text
服务器线上目录：/var/www
前端目录：/var/www/haiou-live
后端服务：haiou-api
PM2 进程名：haiou-api
Nginx 域名：s6.lol / www.s6.lol
API 代理：127.0.0.1:3001
当前服务器稳定提交：8b00920 fix: make room profile data room-specific (#52)
```

当前服务器版本已经验证：

```text
Nginx：active running
PM2：haiou-api online
磁盘空间：正常
内存：正常
IO wait：正常
公网访问：已恢复
```

## 生产操作原则

```text
1. 线上可用优先，不做大范围重构。
2. 不在 /var/www 直接执行 git reset --hard。
3. 不在 /var/www 直接粗暴 git pull。
4. 前端小改动只更新对应文件。
5. 后端没改时，不重启 PM2。
6. 任何部署前先备份、先看 diff、再执行。
7. GitHub main 必须保持和线上稳定代码一致。
```

## 禁止提交到 GitHub 的内容

以下内容不能进入版本库：

```text
.env
node_modules/
haiou-live/uploads/
haiou-live/assets/data/replays.local.json
*.bak*
*.tar.gz
*.log
```

原因：

```text
.env 包含数据库密码和 JWT_SECRET
node_modules 是依赖产物
uploads 是线上运行数据
bak / tar.gz 是历史备份垃圾
log 是运行日志
```

## 安全部署方式

推荐流程：

```bash
cd /root/HO-Live-temp

git fetch origin
git status
git diff --name-only HEAD origin/main
```

确认只涉及安全文件后，再把具体文件复制到生产目录。示例：

```bash
cp /root/HO-Live-temp/haiou-live/assets/js/rooms.js /var/www/haiou-live/assets/js/rooms.js
```

前端静态文件更新后通常不需要重启 PM2。最多检查 Nginx：

```bash
nginx -t
systemctl reload nginx
```

只有后端代码或环境变量变化时，才允许：

```bash
pm2 restart haiou-api --update-env
```

## 回退方式

如果前端文件更新后异常，优先回退单个文件，不要整仓重置。

```bash
cp /var/www/haiou-live/assets/js/rooms.js.bak /var/www/haiou-live/assets/js/rooms.js
```

如果必须回退 Git 版本，先确认云盘 IO 正常，再执行，且必须备份。

## 当前说明

```text
2026-06-20：服务器因生产目录强制同步触发云盘 IO 告警，已恢复。
后续所有同步必须小步、低 IO、可回滚。
```
