# 海鸥直播 / HO-Live

> **重要：本 README 曾包含 2026-06-20 的历史服务器状态记录。该记录不代表当前服务器、域名或线上版本仍存在或可用。当前没有完成生产部署验证；不要直接照抄其中的旧服务器路径或操作命令。**

## 当前代码与恢复点

本轮上线准备修复在独立分支和 Draft Pull Request 中进行，尚未合并或部署。

```text
修复前提交：740259fa29880cf9bd82bb5c8ade2ca68b09c01d
修复前备份分支：backup/main-before-readiness-fixes-2026-10-23
修复分支：fix/production-readiness-2026-10-23
Pull Request：https://github.com/imtaka1988-lgtm/HO-Live/pull/56
```

恢复和回退说明见 [docs/BACKUP_AND_ROLLBACK.md](docs/BACKUP_AND_ROLLBACK.md)。

## 项目结构

- `haiou-live/`：静态网页与前端资源。
- `haiou-api/`：Node.js API、WebSocket 聊天服务和数据库脚本。
- `docs/SERVER_MIGRATION.md`：新服务器安装、旧库恢复、环境配置、验证和上线清单。

## 新装与迁移

请先阅读 [服务器迁移手册](docs/SERVER_MIGRATION.md)。新安装与恢复旧数据库是两条不同流程：

- 新安装：创建空数据库，运行 `npm run bootstrap-schema`，再运行 `npm run migrate`。
- 从旧服务器迁移：先导入经过校验的数据库备份，再运行 `npm run migrate`。
- 运行完整 API 检查：进入 `haiou-api/`，配置好环境变量后执行 `npm ci` 和 `npm run verify`。

这些命令需要 Node.js、MySQL 和合适的数据库权限。本仓库的自动化检查通过并不等于已经完成实际 MySQL 初始化、浏览器端到端验证或正式直播推流测试。

## 备份边界

Git 备份分支保存已提交并受 Git 跟踪的代码文件和历史，不包含运行时 MySQL 数据、未跟踪的上传文件、`.env`、密钥、证书、外部直播服务配置、DNS 或域名注册状态。生产环境存在后，应独立备份数据库和媒体文件，并将秘密保存在受控位置，不能提交到 Git。

禁止提交：

```text
.env
node_modules/
haiou-live/uploads/
haiou-live/assets/data/replays.local.json
*.bak*
*.tar.gz
*.log
```

## 上线前禁止事项

- 不要直接在 `main` 上试验修复。
- 不要在未备份数据库前运行迁移。
- 不要把代码回退当成数据库回退。
- 不要在未验证源环境、目标环境、备份和回退步骤前执行生产部署。
- 不要把历史记录中出现的服务器路径、域名或服务状态当作当前事实。

## 历史记录（仅供参考）

旧 README 在 2026-06-20 记录过服务器目录 `/var/www`、域名 `s6.lol / www.s6.lol` 以及一条历史稳定提交。上述信息只反映当时的记录，当前是否仍有效尚未验证。

