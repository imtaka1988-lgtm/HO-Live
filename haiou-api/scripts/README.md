# 数据库迁移与运维脚本

这些是历史数据库迁移和一次性运维脚本，不再需要日常运行。

| 脚本 | 用途 | 状态 |
|------|------|------|
| `add_cols.js` | 给 rooms 表加字段 | 已执行 |
| `add_sports.js` | 插入体育赛事数据 | 已执行 |
| `create_admin.js` | 创建管理员账号 | 按需使用 |
| `fix_jwt.js` | 修复 JWT 密钥相关问题 | 已执行 |
| `insert_sports.js` | 批量导入体育数据 | 已执行 |
| `normalize.js` | 数据规范化处理 | 已执行 |
| `reimport.js` | 重新导入某批数据 | 已执行 |
| `remove_fallback.js` | 移除 fallback 数据 | 已执行 |
| `rename_streams.js` | 重命名流线路 | 已执行 |
| `rotate.js` | 日志/数据轮转 | 待确认 |

## 使用方式

```bash
cd haiou-api
node scripts/<脚本名>.js
```

**注意：大部分脚本已执行完毕，不要在线上重复运行。**
