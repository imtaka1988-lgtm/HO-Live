# 海鸥直播 / HO-Live

> 当前状态：2026-06-18 近成品稳定版。以当前线上服务器效果为准：手机端、电脑端直播播放已恢复正常；手机直播间键盘弹起后的大面积遮挡问题已修复。当前不再建议继续做高风险前端重构。

本仓库是海鸥直播体育直播站代码仓库。当前维护原则：

```text
1. 以线上可运营为第一优先级。
2. 播放器主链路已经可用，不要随意重构。
3. 手机直播间键盘布局已经接近可运营，不要再激进优化。
4. 所有后续修改必须先备份，再小步提交，再真机验证。
```

---

## 一、当前稳定基线

当前最接近成品的备份分支：

```text
stable-near-final-mobile-room-20260618
```

这个分支代表当前“最接近可运营”的版本。  
如果后续修改造成混乱，优先回退到这个分支。

上一个大修前备份分支：

```text
backup-before-mobile-room-fix-20260618
```

这个分支是手机直播间键盘布局修复前的备份。它只作为更早回退点，不是当前首选回退点。

不要再使用旧 README 里提到的这些旧封包分支作为默认上线依据：

```text
release-sealed-20260615-final
stable-sealed-20260614
stable-delivery-20260614
```

这些分支早于当前手机直播间修复，继续按旧分支 `reset --hard` 会误导部署，并可能把当前接近成品的效果覆盖掉。

---

## 二、当前已确认状态

当前线上/当前 main 的核心状态：

```text
1. 手机端直播播放：可用。
2. 电脑端直播播放：可用。
3. 手机直播间输入框弹出键盘：大面积白色遮挡已修复。
4. 手机直播间键盘收起后：可能有轻微白色延迟消失，当前接受，不再激进优化。
5. 播放器 HLS/FLV 主逻辑：不要再随意改。
6. 后台和直播配置：保持现状，小步维护。
```

重要说明：

```text
键盘收起后那一下白色延迟，不要继续硬修。
之前尝试过“发送按钮提前收起 focus”的方案，会造成更严重的持续遮挡。
当前策略是接受轻微过渡，不再碰这块逻辑。
```

---

## 三、服务器同步命令

如果服务器当前已经正常，不要随便 reset。  
只在确认要部署 GitHub main 时执行：

```bash
cd /var/www

git fetch origin
git pull --ff-only origin main
```

如果 `git pull --ff-only` 报错，说明服务器本地和 GitHub 有分叉。不要直接强制覆盖，先检查：

```bash
git status
git log --oneline -5
```

本轮手机直播间修复主要是前端静态文件更新，通常不需要重启后端。  
如果你改了后端或环境变量，再执行：

```bash
pm2 restart all
```

如果改了 Nginx 配置，才需要：

```bash
nginx -t && systemctl reload nginx
```

---

## 四、回退方式

### 1. 回到当前近成品稳定版

```bash
cd /var/www

git fetch origin
git reset --hard origin/stable-near-final-mobile-room-20260618
```

这是当前首选回退方式。

### 2. 回到手机直播间修复前版本

只有当前稳定版也有严重问题时，才使用：

```bash
cd /var/www

git fetch origin
git reset --hard origin/backup-before-mobile-room-fix-20260618
```

### 3. 如果 GitHub main 也需要回退

先在服务器本地确认回退后效果正常，再执行：

```bash
git push -f origin main
```

强制推送会覆盖 GitHub main。没有确认前不要用。

---

## 五、手机直播间相关文件说明

当前手机直播间最关键的文件：

```text
haiou-live/pages/room.html
haiou-live/assets/js/main.js
haiou-live/assets/js/router.js
haiou-live/assets/js/mobile-chat-focus.js
haiou-live/assets/css/mobile-chat-keyboard.css
haiou-live/assets/css/site.css
```

### 1. room.html

直播间页面入口。  
当前会加载：

```text
hls.min.js
flv.min.js
main.js
room-anchor-avatar.js
player-mobile-autoplay-fix.js
```

不要随意调整这些脚本顺序。

### 2. main.js

前端主入口。  
负责加载配置、全局 UI、路由、播放器增强、手机键盘修复模块等。

### 3. router.js

直播间 DOM 主要由这里生成。  
当前已经避免在这里重复绑定手机输入框 focus/blur。  
不要重新加回重复 focus 逻辑。

### 4. mobile-chat-focus.js

手机直播间输入法聚焦保护。  
当前原则：

```text
只更新 --room-vh
只加/删 mobile-chat-focus
不再给 body/app/video 大量写 inline style
不再监听发送按钮提前强制关闭 focus
```

不要再加入复杂的 pointerdown / touchstart 强制收键盘逻辑。

### 5. mobile-chat-keyboard.css

手机直播间键盘布局 CSS。  
当前已经避免 `body[data-page="room"] { position: fixed; }` 这类容易造成 iOS 键盘错位的写法。

不要再把整个 body 强制 fixed。

---

## 六、播放器相关原则

播放器当前能用，不要轻易重构。

不要随意改这些文件：

```text
haiou-live/assets/js/player.js
haiou-live/assets/js/player-switch-stability.js
haiou-live/assets/js/player-line-switcher.js
haiou-live/assets/js/player-mobile-autoplay-fix.js
haiou-live/assets/css/player-line-switcher.css
haiou-live/assets/css/player-cover-fit.css
```

除非出现明确、可复现的播放 bug，否则不要动播放器主链路。

当前建议：

```text
1. HLS / FLV 线路能播就不要改。
2. iOS/Safari 直播能播就不要改。
3. Android/PC 直播能播就不要改。
4. 线路切换逻辑不要为了显示优化去重构。
```

---

## 七、当前可接受的小瑕疵

当前已知但不建议继续处理的点：

```text
手机直播间键盘收起后，白色区域可能会延迟一小会消失。
```

原因是 iOS/手机浏览器键盘收起时，`visualViewport` 高度恢复和页面布局恢复并不是同步完成。  
当前版本至少不会持续遮挡，属于可接受瑕疵。

不要为了这个小过渡继续激进修改。之前已经验证过，过度优化会引入更严重问题。

---

## 八、上线后检查清单

每次更新后，至少检查：

```text
1. 首页能打开
2. 直播列表能打开
3. 手机直播间能打开
4. 手机端能播放
5. 电脑端能播放
6. 手机直播间点输入框，键盘弹出不再大面积遮挡
7. 手机直播间发送消息后，键盘收起能恢复
8. 后台能登录
9. 房间列表能加载
10. 手动填写 m3u8 / flv 后前台能播放
```

手机直播间重点测试：

```text
1. 进入直播间
2. 点聊天输入框
3. 键盘弹出
4. 输入文字
5. 收起键盘
6. 再次点输入框
7. 切换聊天 / 主播资料
```

---

## 九、环境变量提醒

数据库密码建议配置：

```bash
DB_PASS=你的数据库密码
```

如果数据库确实故意使用空密码，才临时设置：

```bash
ALLOW_EMPTY_DB_PASS=1
```

直播回调推荐配置：

```bash
LIVE_CALLBACK_KEY=你自己设置的随机长字符串
```

云厂商回调地址示例：

```text
https://你的域名/api/live/callback?key=同一个随机长字符串
```

正式环境不建议长期放开无 key 回调。

---

## 十、CORS 说明

如果前端和 API 同域，例如：

```text
https://s6.lol/api/...
```

通常不需要额外设置 CORS。

如果前端和 API 分开域名，例如：

```text
前端：https://s6.lol
API：https://api.s6.lol
```

可以设置：

```bash
CORS_ORIGIN=https://s6.lol
```

多个域名用英文逗号分隔：

```bash
CORS_ORIGIN=https://s6.lol,https://www.s6.lol
```

---

## 十一、Git 提交注意事项

不要把服务器备份包提交到 GitHub，例如：

```text
*.tar.gz
*.zip
*.bak
```

不要提交：

```text
.env
node_modules/
logs/
*.log
```

如果误提交了压缩包，先从 Git 记录中移除：

```bash
git rm --cached path/to/backup.tar.gz
git commit -m "chore: remove backup archive from repo"
git push origin main
```

---

## 十二、后续维护原则

```text
1. 当前版本先稳定运营。
2. 任何修改先建备份分支。
3. 一次只改一个问题。
4. 播放器、手机键盘、后台保存逻辑都不要大重构。
5. 真机视频复现后再改，不凭感觉改。
```

当前阶段目标不是继续堆功能，而是保持可运营。
