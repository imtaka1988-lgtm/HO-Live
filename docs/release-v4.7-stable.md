# 海鸥直播 V4.7 稳定封包说明

封包日期：2026-06-14
封包基线：main @ 6c91a986c05091076aaab11a02741e7c1a8845e4
版本名称：主播后台 + 云直播回调稳定版

## 一、封包范围

本版本完成海鸥直播后台、主播后台、OBS 推流配置、云直播回调、封面上传、头像上传的第一版闭环。

### 1. 管理员后台

- 房间列表支持“基础信息 / 播放源管理 / 主播后台”行内展开。
- 同一个按钮再次点击可收起。
- 切换不同按钮时，只保留一个展开区。
- 已修复“收起后残留孤立主播后台按钮”的问题。
- 新建房间可自动生成主播账号、主播密码、OBS 推流配置。
- 房间下方“主播后台”面板可维护：
  - 主播账号
  - 主播状态
  - OBS 服务器
  - OBS 推流码
  - 重置主播密码
  - 复制主播登录信息
- 复制给主播时固定包含：
  - 主播后台登录地址：https://s6.lol/pages/anchor.html
  - 主播后台账号
  - 主播后台密码
  - OBS 服务器
  - OBS 推流码

### 2. 主播后台

主播登录地址：

```text
https://s6.lol/pages/anchor.html
```

主播只能管理自己绑定的房间。

主播可修改：

- 房间标题
- 主播名称
- 直播间公告
- 封面图片地址
- 上传封面
- 上传主播头像

主播可查看：

- OBS 服务器
- OBS 推流码

主播不可查看：

- 播放地址
- 其他房间
- 管理员后台
- 用户数据
- 系统配置

### 3. 封面兜底规则

- 主播不填写封面时，不会清空管理员后台原封面。
- 主播上传封面后，前台直播间使用主播上传封面。
- 未上传封面时，继续使用管理员后台设置的封面。

### 4. 主播头像

- 主播可上传头像。
- 头像保存到房间的 `anchor_avatar` 字段。
- 前台直播间顶部主播头像优先使用主播上传头像。

### 5. 全局 OBS 模板

后台新增“全局 OBS 模板”。

支持配置：

- OBS 服务器模板
- OBS 推流码模板
- HLS 播放地址模板
- FLV 播放地址模板

支持变量：

```text
{id}
{roomId}
{streamName}
```

示例：

```text
OBS 推流码模板：room{id}
```

房间 3 自动生成：

```text
room3
```

### 6. 云直播回调

新增接口：

```text
POST /api/live/callback
```

用于直播云服务回调自动修改房间状态。

开播事件会改为：

```text
live
```

下播事件会改为：

```text
offline
```

可选安全参数：

```text
LIVE_CALLBACK_SECRET
```

如果配置了该环境变量，请求必须携带：

```text
?secret=xxx
```

或 header：

```text
x-live-callback-secret: xxx
```

## 二、部署命令

```bash
cd /var/www
git fetch origin main
git reset --hard origin/main
```

后端语法检查和重启：

```bash
cd /var/www/haiou-api

node -c routes/liveCallback.js
node -c routes/adminObsTemplate.js
node -c routes/adminRoomCreatePack.js
node -c routes/anchorUpload.js
node -c routes/adminAnchorBundle.js
node -c routes/anchor.js
node -c routes/public.js
node -c server.js

pm2 restart haiou-api
pm2 list
```

## 三、封包验收清单

### 管理员后台

- [ ] 房间列表可正常打开。
- [ ] 基础信息可展开和收起。
- [ ] 播放源管理可展开和收起。
- [ ] 主播后台可展开和收起。
- [ ] 收起后不残留孤立“主播后台”按钮。
- [ ] 可保存 OBS 服务器和 OBS 推流码。
- [ ] 可重置主播密码。
- [ ] 可复制主播登录信息。
- [ ] 全局 OBS 模板可保存。

### 主播后台

- [ ] 主播可登录。
- [ ] 主播只能看到自己绑定房间。
- [ ] 主播可修改标题、主播名称、公告。
- [ ] 主播不填封面不会清空默认封面。
- [ ] 主播可上传封面。
- [ ] 主播可上传头像。
- [ ] 主播可查看 OBS 服务器和推流码。

### 前台直播间

- [ ] 房间标题同步。
- [ ] 公告同步。
- [ ] 封面同步。
- [ ] 主播头像同步。
- [ ] 播放源不受影响。

### 云直播回调

开播测试：

```bash
curl -s -X POST http://127.0.0.1:3001/api/live/callback \
  -H "Content-Type: application/json" \
  -d '{"streamName":"room1","event":"start"}'
```

下播测试：

```bash
curl -s -X POST http://127.0.0.1:3001/api/live/callback \
  -H "Content-Type: application/json" \
  -d '{"streamName":"room1","event":"stop"}'
```

## 四、封包后规则

本版本封包后进入稳定维护阶段。

允许：

- 修 bug
- 小文案调整
- 小样式调整
- 回调字段兼容
- 上传限制微调

禁止：

- 大改首页结构
- 大改直播间结构
- 大改后台结构
- 新增复杂会员体系
- 新增大型广告系统
- 新增不必要的大模块

## 五、后续独立版本再考虑

以下功能不纳入 V4.7 封包范围，后续单独开版本：

- 主播操作日志
- 云直播回调签名深度校验
- 多主播账号绑定同一房间
- 主播端移动端 UI 精修
- 上传图片裁剪
- 更细的房间权限管理
