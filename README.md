# 海鸥直播 / HO-Live

> 当前状态：2026-06-15 最终整理封包版。当前线上已验证：后端健康检查正常、数据库正常、公共房间接口正常、`npm run check` 通过、PM2 在线、Nginx 配置通过。

这是海鸥直播体育直播站代码仓库。当前版本以“减少堆叠、减少重复路由、保留可回滚点、降低后续维护难度”为主，不再继续做高风险前端大重构。

---

## 一、当前封包结论

建议当前线上使用本次最终封包版本，不再继续追加低价值补丁。

最终封包分支：

```text
release-sealed-20260615-final
```

稳定同步分支：

```text
stable-sealed-20260614
```

本次代码封包提交：

```text
30387c880831237e00b8e93c5e5fc843472d5046
```

本次上线前服务器回滚点：

```text
24bf6295ca4ccd8b7dce8d99e5fc1557ba36b13d
```

如果线上出现严重问题，优先回退到服务器自己的回滚点，而不是盲目回到更早版本。

---

## 二、本轮最终整理内容

本轮已完成的主要整理：

```text
1. 播放器源类型、HLS/FLV 保护、失败切线逻辑收敛
2. 后台播放源保存和测试播放逻辑收敛
3. 公共房间接口 /api/public/rooms 重复路由收敛
4. 后台 API 错误处理统一，不再大量吞成 null
5. 前台生产环境不再静默使用旧 JSON 房间/旧播放源兜底
6. 后端增加 npm run check 语法检查
7. GitHub Actions 增加后端语法检查流程
8. CORS 默认全开放收紧
9. 直播回调 /api/live/callback 重复路由收敛
10. 后台房间新增/列表/删除重复逻辑收敛
11. 后台房间列表排序统一为 sort_order, id
```

---

## 三、服务器更新命令

推荐使用固定封包分支更新：

```bash
cd /var/www

OLD_COMMIT=$(git rev-parse HEAD)
echo "当前服务器回滚点：$OLD_COMMIT"

git fetch origin
git reset --hard origin/release-sealed-20260615-final

cd /var/www/haiou-api
npm install --no-audit --no-fund
npm run check

cd /var/www
pm2 restart all
nginx -t
systemctl reload nginx
```

如果改过 `.env`，重启时使用：

```bash
pm2 restart all --update-env
```

如果 `npm run check` 报错，不要继续重启，先修报错。

如果 `nginx -t` 报错，不要执行 `systemctl reload nginx`。

前端 JS 或页面更新后，浏览器建议强刷：

```text
Ctrl + F5
```

---

## 四、稳定备份与回退

本次上线前服务器实际回滚点：

```text
24bf6295ca4ccd8b7dce8d99e5fc1557ba36b13d
```

回退命令：

```bash
cd /var/www
git reset --hard 24bf6295ca4ccd8b7dce8d99e5fc1557ba36b13d
pm2 restart all
nginx -t
systemctl reload nginx
```

当前最终封包分支：

```text
release-sealed-20260615-final
```

稳定同步分支：

```text
stable-sealed-20260614
```

原始稳定备份分支，也就是更早一轮修复前的备份：

```text
stable-delivery-20260614
```

原始稳定备份提交：

```text
d6b7c9fbf7f0e1e5d017341edd48caa601dd60f6
```

---

## 五、上线后必须检查

服务器检查：

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3001/api/health/db
curl -s http://127.0.0.1:3001/api/public/rooms | head -c 1000
pm2 logs haiou-api --lines 80
```

正常结果应包括：

```text
/api/health 返回 status: ok
/api/health/db 返回 ok: true
/api/public/rooms 返回 ok: true 和 rooms 数组
PM2 显示 haiou-api online
```

如果 `pm2 logs` 里出现旧错误，先执行：

```bash
pm2 flush haiou-api
pm2 logs haiou-api --lines 60
```

清空后如果不再出现，说明是历史日志残留。

---

## 六、环境变量

数据库密码默认要求配置：

```bash
DB_PASS=你的数据库密码
```

如果数据库确实故意使用空密码，才可以临时设置：

```bash
ALLOW_EMPTY_DB_PASS=1
```

正式环境不建议空密码。

Odds API 默认 5 秒超时，可以按需调整：

```bash
ODDS_API_TIMEOUT_MS=5000
```

直播回调推荐使用：

```bash
LIVE_CALLBACK_KEY=你自己设置的随机长字符串
```

云厂商回调地址示例：

```text
https://你的域名/api/live/callback?key=同一个随机长字符串
```

如果暂时不使用云直播回调，可以不用管。

如果临时要放开无 key 回调，可以设置：

```bash
LIVE_CALLBACK_ALLOW_UNSIGNED=1
```

正式环境不建议长期放开。

---

## 七、CORS 当前规则

当前 CORS 已经收紧。

```text
不设置 CORS_ORIGIN 时，不主动开放跨域。
```

如果前端和 API 是同域，例如：

```text
https://s6.lol/api/...
```

通常不需要设置 CORS。

如果前端和 API 分开域名，例如：

```text
前端：https://s6.lol
API：https://api.s6.lol
```

需要设置：

```bash
CORS_ORIGIN=https://s6.lol
```

多个域名用英文逗号分隔：

```bash
CORS_ORIGIN=https://s6.lol,https://www.s6.lol
```

---

## 八、房间 ID 与排序规则

当前房间 ID 规则：

```text
已有房间 ID 不自动改名。
删除 12 号房间后，13 号仍然保持 13。
下一次新建房间时，优先补回最小空缺 ID，也就是补回 12。
```

这样做比“删除 12 后立刻把 13 改成 12”更安全。

原因：房间 ID 会关联主播账号、播放源、推流配置、直播回调记录、后台按钮、前台直播间链接。强行改已有房间 ID 容易导致按钮错位、播放源错位、主播账号错位。

当前房间列表排序规则：

```text
后台房间列表：ORDER BY sort_order, id
前台公共房间列表：ORDER BY sort_order, id
```

重点验收：

```text
1. 删除 12 号房间
2. 再新建房间
3. 新房间应补回 12
4. 房间列表应按 sort_order 优先排序，sort_order 相同再按 id 排序
5. 每行按钮必须对应当前行房间
```

---

## 九、后台手动放视频源

后台手动填 m3u8 / flv 播放源不受直播回调鉴权影响。

你仍然可以按原方式操作：

```text
后台 → 房间 → 填播放源 → 保存 → 前台播放
```

影响范围说明：

```text
后台手动填播放源：不受影响
后台新增房间：会自动生成主播账号和基础推流配置
后台改房间资料：不受影响
用户看直播：不受影响
直播云厂商自动通知开播/关播：需要 key
```

注意：如果前台是 HTTPS，HTTP 的 FLV 播放源可能被浏览器当作混合内容拦截。优先使用 HTTPS 播放源。

---

## 十、当前已知遗留点

### 1. app-page.js 旧播放源逻辑源码残留

`haiou-live/assets/js/app-page.js` 里仍有旧的播放源测试/保存逻辑：

```text
btn-stream-test → window.open(url)
btn-stream-save → 旧 adminUpdateStream 保存逻辑
```

当前运行时已有新模块接管后台播放源保存和测试播放，因此这不是当前上线阻断项。

但后续如果继续整理后台前端，建议单独做：

```text
app-page.js 后台模块拆分
```

不要直接粗暴整文件替换。

### 2. 后台 UI patch 模块仍可继续整理

当前后台 UI 已能使用。继续整理 UI patch 模块属于中风险，不建议在当前稳定封包后立刻继续改。

---

## 十一、重点验收清单

每次更新后，建议至少检查这些：

```text
1. 首页能正常打开
2. 直播列表能正常打开
3. 直播间能正常打开
4. HLS 能播放
5. PC Chrome 下 FLV 能测试
6. 后台能登录
7. 房间列表能加载
8. 新建房间正常
9. 编辑房间资料正常
10. 删除房间正常
11. 删除 12 后再新建能补回 12
12. 房间列表按 sort_order, id 排列
13. 播放源管理能展开
14. 手动填写 m3u8 / flv 播放源后前台能播放
15. 测试播放按钮是后台内嵌测试
16. 上传封面、头像正常
17. 重置主播密码后可以登录主播后台
18. 如果使用直播回调，key 配置正确
19. 聊天室能连接和发言
20. Nginx nginx -t 测试通过
21. 后台 Odds API 健康检查不会长时间卡住
```

---

## 十二、封包建议

当前建议：

```text
不要继续改业务代码。
先观察线上稳定性。
后续只做明确的小任务。
不要继续叠补丁。
```

如果要继续优化，优先级应为：

```text
1. app-page.js 后台模块拆分
2. 后台 UI patch 模块分类收敛
3. 增加更完整的前端构建检查
4. 增加 API 自动化测试
```

这些不属于当前低风险封包范围。
