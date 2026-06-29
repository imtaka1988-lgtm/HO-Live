# 海鸥直播 / HO-Live

> 最后更新：2026-06-28 | 当前稳定运行中

## 项目结构

```
ho-live/
├── haiou-api/          # 后端 API (Node.js/Express, PM2 管理)
├── haiou-live/         # 前端静态站点
│   ├── assets/         # CSS / JS / 图片 / 数据
│   └── pages/          # HTML 页面
├── nginx/              # Nginx 配置
└── .github/workflows/  # CI（语法检查）
```

## 线上部署信息

| 项目 | 值 |
|------|-----|
| 服务器目录 | `/var/www` |
| 前端 | `/var/www/haiou-live` |
| 后端 | `haiou-api`（PM2 进程名） |
| 端口 | `127.0.0.1:3001` |
| 域名 | `s6.lol` / `www.s6.lol` |

## 部署原则

1. 线上可用优先，不做大范围重构
2. 不在 `/var/www` 直接执行 `git reset --hard` 或强制 `git pull`
3. 前端小改动只更新对应文件，后端没改不重启 PM2
4. 任何部署前先备份、先看 diff、再执行
5. GitHub `main` 分支保持与线上一致

## 禁止提交的内容

| 类别 | 文件 |
|------|------|
| 敏感信息 | `.env`, `*.env` |
| 依赖 | `node_modules/` |
| 运行时数据 | `haiou-live/uploads/`, `replays.local.json` |
| 归档/日志 | `*.tar.gz`, `*.bak*`, `*.log`, `logs/` |

## 安全部署流程

```bash
# 1. 在独立目录拉取最新代码
cd /root/HO-Live-temp
git fetch origin
git diff --name-only HEAD origin/main

# 2. 确认变更安全后，逐文件复制
cp /root/HO-Live-temp/haiou-live/assets/js/rooms.js /var/www/haiou-live/assets/js/rooms.js

# 3. 前端更新后通常无需重启 PM2；若需检查 Nginx：
nginx -t && systemctl reload nginx

# 4. 仅后端变更时才重启
pm2 restart haiou-api --update-env
```

## 回退

前端文件异常时优先单文件回退，不要整仓重置：

```bash
cp /var/www/haiou-live/assets/js/rooms.js.bak /var/www/haiou-live/assets/js/rooms.js
```
