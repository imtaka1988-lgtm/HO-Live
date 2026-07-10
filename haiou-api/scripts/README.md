# 数据库迁移与运维脚本

生产环境只保留两个受支持命令：

## 数据库迁移

```bash
cd haiou-api
npm run migrate
```

迁移是幂等的。新服务器导入数据库备份后、启动 API 前执行。迁移账号需要临时拥有 `CREATE`、`ALTER` 和 `INDEX` 权限；完成后可收紧为业务运行权限。

## 创建或重置管理员

先通过环境变量提供账号和强密码，不要把密码写进脚本或提交到 Git：

```bash
cd haiou-api
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='替换为至少12位的强密码' \
npm run create-admin
```

该命令不会输出明文密码。相同用户名已存在时会更新密码哈希。

历史一次性补丁、清库脚本和直接改写源码的脚本已经移除，避免在新服务器误执行。
