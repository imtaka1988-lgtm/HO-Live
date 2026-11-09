# HO-Live 代码备份与回退说明

本文记录本轮修复前的 Git 代码恢复点，以及上线前必须遵守的回退边界。

## 1. 本轮修复前的代码快照

- 仓库：`imtaka1988-lgtm/HO-Live`
- 修复前提交：`740259fa29880cf9bd82bb5c8ade2ca68b09c01d`
- 固定备份分支：`backup/main-before-readiness-fixes-2026-10-23`
- 本轮修复分支：`fix/production-readiness-2026-10-23`

备份分支从上面的精确提交建立，保存了修复前该提交的完整 Git 跟踪文件快照及其历史祖先。请保留该分支，不要把修复提交推入此分支。

## 2. 从修复前提交恢复代码

建议新建恢复分支，不要通过强制推送重写 `main`：

```bash
git fetch origin
git switch --create restore/pre-readiness-fixes 740259fa29880cf9bd82bb5c8ade2ca68b09c01d
```

也可以直接从备份分支创建恢复分支：

```bash
git fetch origin
git switch --create restore/pre-readiness-fixes origin/backup/main-before-readiness-fixes-2026-10-23
```

核对恢复点：

```bash
git rev-parse HEAD
```

结果应为 `740259fa29880cf9bd82bb5c8ade2ca68b09c01d`。

若本轮修复的 Pull Request 已合并且要撤销它，优先通过 GitHub 创建 revert PR，或对对应合并提交执行 `git revert`。不要在共享仓库里对 `main` 执行 `git reset --hard` 后强制推送。

## 3. 服务器发布与回退要求

每次发布都要保存并记录正在运行的 Git 提交 SHA。采用版本目录或单独 release 目录部署，先验证新版本，确认失败时可重新指向上一稳定版本。保留上一稳定版本及日志，直到观察期结束。

代码回退不等同于数据库回退。如果一次发布执行了数据库迁移：
1. 在执行迁移前先制作数据库备份，并验证备份文件非空且可读取。
2. 记录迁移前后版本以及备份校验值。
3. 不要因为代码回退就直接用旧数据库覆盖新数据库；先评估迁移期间产生的数据。
4. 对不可逆的结构变更，必须先设计兼容性和恢复步骤，再发布。

## 4. 此 Git 备份不包含的内容

Git 分支只保存已提交并受 Git 跟踪的代码和文档，不包含：
- MySQL 中的用户、房间、聊天记录等运行数据；
- `uploads/` 等运行时媒体文件（若未提交到 Git）；
- 服务器上的 `.env`、私钥、证书、令牌或其他未提交的秘密；
- 直播供应商、DNS、域名注册商及服务器配置等外部系统状态。

这些数据要在真实服务器和数据库存在时单独备份到受控位置，不能把生产密码或密钥提交到仓库。当前项目尚未进行生产服务器操作，本轮操作没有改动生产环境。

## 5. 当前变更的安全边界

所有代码修改只应进入 `fix/production-readiness-2026-10-23` 和后续 Pull Request。只有代码审查和测试通过后才考虑合并；在合并和上线之前，`main` 与备份分支应保持原样。
