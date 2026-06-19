# 海鸥直播 / HO-Live

> 当前状态：2026-06-19 稳定版。首页播放器右侧卡片已修复为优先显示正在直播的房间，并会每 30 秒安全轮询房间状态；手机端、电脑端直播播放维持可用；手机直播间键盘遮挡问题继续保持上一版稳定策略。当前不建议继续做大范围前端重构。

本仓库是海鸥直播体育直播站代码仓库。当前维护原则：

```text
1. 以线上可运营为第一优先级。
2. 播放器主链路已经可用，不要随意重构。
3. 首页 hero 右侧卡片已接入 live 房间刷新，不要再重复实现另一套刷新逻辑。
4. 手机直播间键盘布局已经接近可运营，不要再激进优化。
5. 所有后续修改必须先备份，再小步提交，再真机验证。
```

---

## 一、当前稳定基线

当前首选稳定备份分支：

```text
backup/stable-hero-live-refresh-20260619
```

这个分支代表 2026-06-19 首页 hero 直播房间刷新修复后的稳定版本。  
如果后续修改造成首页卡片、播放器或直播间异常，优先回退到这个分支。

对应关键提交：

```text
0befe5c fix: refresh home hero cards from live rooms
```

上一个近成品稳定分支：

```text
stable-near-final-mobile-room-20260618
```

这个分支代表手机直播间键盘布局修复后的稳定版本，但早于首页 hero 右侧卡片刷新修复。

更早的大修前备份分支：

```text
backup-before-mobile-room-fix-20260618
```

这个分支是手机直播间键盘布局修复前的备份，只作为更早回退点，不是当前首选回退点。

不要再使用这些旧封包分支作为默认上线依据：

```text
release-sealed-20260615-final
stable-sealed-20260614
stable-delivery-20260614
```

这些分支早于当前手机直播间修复和首页 hero 直播卡片刷新修复，继续按旧分支 `reset --hard` 会误导部署。

---

## 二、当前已确认状态

当前线上 / 当前 main 的核心状态：

```text
1. 首页播放器右侧卡片：优先显示正在 live 的房间。
2. 首页 hero 卡片刷新：每 30 秒轮询 /api/public/rooms。
3. 首页 hero 卡片行为：如果 live 房间列表不变，不会自动轮播、不乱跳。
4. 首页 hero 卡片变化条件：开播、关播、顺序、封面、标题、播放源发生变化时才重建。
5. 手机端直播播放：可用。
6. 电脑端直播播放：可用。
7. 手机直播间输入框弹出键盘：大面积白色遮挡已修复。
8. 手机直播间键盘收起后：可能有轻微白色延迟消失，当前接受，不再激进优化。
9. 播放器 HLS/FLV 主逻辑：不要随意改。
10. 后台和直播配置：保持现状，小步维护。
```

重要说明：

```text
30 秒逻辑是轮询刷新，不是自动轮播。
如果当前正好只有 5 个 live 房间，右侧卡片会保持稳定，不会每 30 秒自动切换。
```

---

## 三、本轮首页 hero 修复说明

核心修改文件：

```text
haiou-live/assets/js/rooms.js
```

本轮只修改了首页与直播列表模块，没有修改：

```text
1. 后台接口
2. router.js
3. player.js
4. CSS 样式
5. site-config.json
6. Nginx 配置
```

修复后的核心行为：

```text
1. renderHome() 初始渲染时，hero 右侧卡片优先取 live 房间。
2. bindHeroEvents() 执行后启动 hero 自动刷新。
3. refreshHeroRooms() 每 30 秒请求 /api/public/rooms。
4. 如果 live 房间列表没有变化，只更新内存数据，不重建 DOM。
5. 如果 live 房间列表变化，重建 #heroSideCards 并重新绑定点击事件。
6. 如果当前选中的房间仍在 live 列表中，尽量保留当前选中项。
7. 如果当前选中的房间已关播，则切换到新的第一个 live 房间。
8. 如果没有 live 房间，则回退显示普通房间，避免首页卡片直接空白。
```

可关闭开关：

```text
state.cfg.heroAutoRefresh === false
```

默认行为是开启刷新；只有显式设置为 `false` 才会关闭。

---

## 四、服务器同步命令

服务器目录通常是：

```bash
cd /var/www
```

正常同步 GitHub main：

```bash
cd /var/www

git status
git fetch origin
git checkout main
git pull --ff-only origin main
```

确认版本：

```bash
git log --oneline -5
```

应该能看到：

```text
0befe5c fix: refresh home hero cards from live rooms
```

本轮主要是前端静态 JS 更新，通常不需要重启后端。  
如果只是更新前端文件，最多执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果改了后端或环境变量，再执行：

```bash
pm2 restart all
```

如果浏览器仍看到旧效果，优先处理缓存：

```text
1. Ctrl + F5 强刷
2. 无痕窗口测试
3. 检查 CDN / 浏览器缓存
```

---

## 五、回退方式

### 1. 回到当前首页 hero 修复稳定版

首选回退：

```bash
cd /var/www

git fetch origin
git reset --hard origin/backup/stable-hero-live-refresh-20260619
```

这是当前首选回退方式。

### 2. 回到手机直播间稳定版

如果首页 hero 修复版本身有严重问题，但手机直播间稳定版可接受，再使用：

```bash
cd /var/www

git fetch origin
git reset --hard origin/stable-near-final-mobile-room-20260618
```

### 3. 回到手机直播间修复前版本

只有当前稳定版和手机直播间稳定版都有严重问题时，才使用：

```bash
cd /var/www

git fetch origin
git reset --hard origin/backup-before-mobile-room-fix-20260618
```

### 4. 如果 GitHub main 也需要回退

先在服务器本地确认回退后效果正常，再执行：

```bash
git push -f origin main
```

强制推送会覆盖 GitHub main。没有确认前不要用。

---

## 六、首页 hero 相关文件说明

当前首页 hero 右侧卡片最关键文件：

```text
haiou-live/assets/js/rooms.js
haiou-live/assets/js/config.js
haiou-live/assets/js/router.js
```

### 1. rooms.js

负责首页渲染、直播列表渲染、首页 hero 预览播放、右侧卡片点击事件、首页 odds 区域等。

当前不要重复新增另一套 hero 刷新逻辑。  
如果要调整首页右侧卡片，只围绕已有这些函数小步修改：

```text
getHeroRooms()
renderHeroSideCards()
refreshHeroRooms()
rebuildHero()
startHeroAutoRefresh()
```

### 2. config.js

负责加载 `site-config.json` 和 `/api/public/rooms`。  
当前不要随便改变 API 房间字段归一化逻辑，否则可能影响直播间播放源。

### 3. router.js

首页由 `bootPage()` 渲染后调用 `bindHeroEvents()`。  
不要把 hero 刷新逻辑搬到 router 里，避免页面职责混乱。

---

## 七、手机直播间相关文件说明

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

直播间页面入口。当前会加载：

```text
hls.min.js
flv.min.js
main.js
room-anchor-avatar.js
player-mobile-autoplay-fix.js
```

不要随意调整这些脚本顺序。

### 2. main.js

前端主入口。负责加载配置、全局 UI、路由、播放器增强、手机键盘修复模块等。

### 3. router.js

直播间 DOM 主要由这里生成。  
当前已经避免在这里重复绑定手机输入框 focus / blur。不要重新加回重复 focus 逻辑。

### 4. mobile-chat-focus.js

手机直播间输入法聚焦保护。当前原则：

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

## 八、播放器相关原则

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

## 九、当前可接受的小瑕疵

当前已知但不建议继续处理的点：

```text
手机直播间键盘收起后，白色区域可能会延迟一小会消失。
```

原因是 iOS / 手机浏览器键盘收起时，`visualViewport` 高度恢复和页面布局恢复并不是同步完成。  
当前版本至少不会持续遮挡，属于可接受瑕疵。

不要为了这个小过渡继续激进修改。之前已经验证过，过度优化会引入更严重问题。

---

## 十、上线后检查清单

每次更新后，至少检查：

```text
1. 首页能打开
2. 首页播放器右侧卡片优先显示 live 房间
3. 后台开播新房间后，首页右侧卡片 30 秒内更新
4. 后台关播当前房间后，首页右侧卡片切换到其他 live 房间
5. 点击首页右侧卡片，封面、预览流、进入直播间链接同步变化
6. 直播列表能打开
7. 手机直播间能打开
8. 手机端能播放
9. 电脑端能播放
10. 手机直播间点输入框，键盘弹出不再大面积遮挡
11. 手机直播间发送消息后，键盘收起能恢复
12. 后台能登录
13. 房间列表能加载
14. 手动填写 m3u8 / flv 后前台能播放
```
