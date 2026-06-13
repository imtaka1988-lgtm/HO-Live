# 海鸥直播 — 无备案海外直播云接入方案

> 版本：V4.1.2
> 更新时间：2026-06-12
> 适用场景：无中国大陆 ICP 备案，服务器和直播云均使用香港/海外节点

---

## 一、项目定位

### 1.1 为什么不做大陆备案

中国大陆境内提供视频直播服务需要：

- **ICP 备案**（工业和信息化部）
- **网络视听许可证**（广电总局，外资禁入）
- **增值电信业务经营许可证**
- 域名必须绑定已备案主体

本项目目前不具备上述资质，因此**不采用任何中国大陆境内云直播或 CDN 节点**。

### 1.2 最终确定架构

经过业务确认，最终直播架构如下：

```
OBS 推流
  ↓
push.haioulive.com（推流域名）
  ↓
腾讯云国际站 / 海外直播
  ↓
pull.haioulive.com（播放域名）生成 m3u8 / flv
  ↓
后台管理员填入 m3u8 / flv 播放地址
  ↓
前端直播间按 roomId 加载对应播放地址
```

### 1.3 职责边界

| 组件 | 负责方 | 职责 |
|------|--------|------|
| OBS 推流 | 主播/运营 | 推流到 `rtmp://push.haioulive.com/live/...` |
| 转码/切片/CDN | 腾讯云国际站 | 源站已含转码和分发，无需自建 |
| 自有域名 | 本项目 | `push.haioulive.com` + `pull.haioulive.com` |
| 香港服务器 | 本项目 | 前端页面 + 后台管理 + API + 数据库 + 用户 + 聊天室 |
| 前端播放器 | 本项目 | 读取 API 返回的播放地址，hls.js 播放 |

**本项目的香港服务器不承担任何视频流转发或切片。**

---

## 二、为什么不用中国大陆直播/播放域名

### 2.1 备案要求

- 域名绑定中国大陆 CDN 或直播云加速节点时，服务商要求域名已备案
- 未备案域名即使解析到香港服务器，一旦使用境内直播/点播/全站加速，会被拦截
- 腾讯云直播（国内站）、阿里云直播（国内站）的播放域名必须备案

### 2.2 本项目的选择

| 方案 | 可行性 | 说明 |
|------|--------|------|
| 中国大陆直播云 + 备案 | ❌ 当前不可行 | 需要完整资质 |
| 自有域名 + 腾讯云国际站/海外直播 | ✅ 当前方案 | 无备案要求，自有域名 |
| 自建 SRS + CDN | ❌ 不采用 | 运维成本高、不自建 |
| 使用第三方盗播源 | ❌ 不采用 | 法律风险、不稳定 |

---

## 三、自有域名模型

### 3.1 域名规划

正式业务必须使用自有域名，推流域名和播放域名必须分开：

| 域名 | 用途 | 示例 |
|------|------|------|
| `push.haioulive.com` | OBS 推流地址（rtmp） | `rtmp://push.haioulive.com/live/room001` |
| `pull.haioulive.com` | 播放地址（HLS/FLV） | `https://pull.haioulive.com/live/room001.m3u8` |

### 3.2 为什么要分开

- 推流域名用于 OBS → 腾讯云的上行流，不需要对外暴露
- 播放域名用于用户浏览器拉流，走 CDN 下行分发
- 分开后可以独立配置安全策略（推流可开启 IP 白名单，播放可开启 referer 防盗链）

### 3.3 中国大陆用户访问路径

中国大陆用户访问 `pull.haioulive.com` 时走腾讯云海外 CDN 节点，不会触发备案拦截。

### 3.4 liveCloud 配置模型

```json
{
  "liveCloud": {
    "provider": "tencent-intl",
    "regionMode": "overseas",
    "requiresIcp": false,
    "pushDomain": "push.haioulive.com",
    "pullDomain": "pull.haioulive.com",
    "appName": "live",
    "defaultAuthEnabled": false,
    "httpsEnabled": true,
    "cdnMode": "overseas"
  }
}
```

---

## 四、腾讯云国际站控制台配置步骤

以下为管理员在腾讯云国际站 / 海外直播控制台的操作流程：

### 4.1 添加域名

1. 登录腾讯云国际站控制台 → 云直播
2. 添加**推流域名**：`push.haioulive.com`
3. 添加**播放域名**：`pull.haioulive.com`
4. 控制台会为每个域名生成一条 CNAME 记录（类似 `xxx.livepush.myqcloud.com`、`xxx.liveplay.myqcloud.com`）

### 4.2 DNS 配置 CNAME

1. 复制控制台给出的推流域名 CNAME
2. 到域名 DNS 服务商（如 Cloudflare、DNSPod）添加 CNAME 记录：
   - `push.haioulive.com` → CNAME → `xxx.livepush.myqcloud.com`
   - `pull.haioulive.com` → CNAME → `xxx.liveplay.myqcloud.com`
3. 等待 CNAME 生效（通常几分钟到 1 小时）
4. 控制台会显示状态为"已生效"

### 4.3 配置 HTTPS

1. 在控制台中为播放域名 `pull.haioulive.com` 申请或上传 SSL 证书
2. 腾讯云通常提供免费 DV 证书，可一键申请
3. 证书生效后，播放地址强制使用 `https://`

> 注意：播放地址必须使用 HTTPS，否则浏览器会因 Mixed Content 策略阻止拉流。

### 4.4 生成推流地址

1. 进入**地址生成器**
2. 选择推流域名：`push.haioulive.com`
3. 填写 AppName：`live`
4. 填写 StreamName：`room001`（按直播间编号命名）
5. 鉴权：先选择**关闭**（测试稳定后再开启）
6. 生成 OBS 推流地址，格式类似：
   ```
   rtmp://push.haioulive.com/live/room001?txSecret=xxx&txTime=xxx
   ```
7. 将此地址填入 OBS → 设置 → 推流

### 4.5 生成播放地址

1. 在地址生成器中选择播放域名：`pull.haioulive.com`
2. 使用相同的 AppName：`live`
3. 使用相同的 StreamName：`room001`
4. 生成播放地址：
   ```
   RTMP:  rtmp://pull.haioulive.com/live/room001
   FLV:   https://pull.haioulive.com/live/room001.flv
   HLS:   https://pull.haioulive.com/live/room001.m3u8
   ```
5. 将 HLS/FLV 地址复制到后台直播间管理 → streams 配置

### 4.6 鉴权说明

- **开发测试阶段**：关闭播放鉴权（authEnabled = false），简化调试
- **正式上线后**：可开启播放鉴权，此时后端需要负责生成临时的鉴权 URL（txSecret/txTime），前端拿到的是已经签好的完整播放地址

### 4.7 关键注意事项

1. **推流地址永远不下发到前端 API**
2. 前端只接收 `hlsUrl` / `flvUrl` / `webrtcUrl`
3. 后台管理员页面可查看推流地址，但有权限控制
4. 播放域名必须配置 HTTPS
5. 中国大陆用户访问 pull 域名走海外节点，延迟取决于节点位置

---

## 五、香港服务器负责的内容

```
香港服务器（轻量应用服务器 / VPS）
├── Nginx 静态文件服务
│   ├── index.html
│   ├── pages/*.html
│   ├── assets/css/site.css
│   ├── assets/js/*.js (含 player.js)
│   └── assets/vendor/hls.min.js
├── 后端 API（Go/Node.js/Python 任选）
│   ├── GET  /api/site/config
│   ├── GET  /api/rooms
│   ├── GET  /api/rooms/{id}
│   ├── GET  /api/rooms/{id}/streams
│   ├── GET  /api/schedules
│   ├── GET  /api/ads
│   ├── POST /api/auth/login
│   ├── POST /api/auth/register
│   └── ...
├── 后台管理接口
│   ├── PUT  /admin/api/rooms/{id}/streams  ← 填写 m3u8/flv 播放地址
│   ├── CRUD /admin/api/rooms
│   ├── CRUD /admin/api/schedules
│   ├── CRUD /admin/api/ads
│   └── ...
├── WebSocket 服务
│   └── wss://域名/ws/chat?roomId=1
└── 数据库（MySQL/PostgreSQL）
    ├── rooms（直播间 + 播放地址）
    ├── schedules（赛程）
    ├── ads（广告）
    ├── users（用户）
    └── chat_messages（聊天记录）
```

---

## 六、播放地址管理模型

### 6.1 后台填写

管理员在后台为每个直播间填写播放地址（从腾讯云控制台复制）：

```json
{
  "roomId": 1,
  "streams": [
    {
      "name": "腾讯云HLS线路",
      "type": "hls",
      "url": "https://pull.haioulive.com/live/room001.m3u8",
      "provider": "tencent-intl",
      "enabled": true,
      "default": true,
      "priority": 1,
      "region": "overseas",
      "appName": "live",
      "streamName": "room001",
      "authEnabled": false,
      "remark": "腾讯云国际站海外直播 HLS 播放地址"
    },
    {
      "name": "腾讯云FLV线路",
      "type": "flv",
      "url": "https://pull.haioulive.com/live/room001.flv",
      "provider": "tencent-intl",
      "enabled": true,
      "default": false,
      "priority": 2,
      "region": "overseas",
      "appName": "live",
      "streamName": "room001",
      "authEnabled": false,
      "remark": "腾讯云国际站海外直播 FLV 播放地址，PC端备用"
    }
  ]
}
```

### 6.2 API 下发

前端请求 `GET /api/rooms/{id}` 时，只返回 `streams` 中的播放地址。

**绝不返回：**

- OBS 推流地址（`rtmp://push.haioulive.com/live/...`）
- 推流密钥（stream key / txSecret）
- 直播云控制台账号密码
- CDN 回源地址
- `pushDomain` 信息（仅后台管理可见）

### 6.3 前端播放

```text
用户在 Chrome / Safari 打开直播间
  → fetch /api/rooms/1
  → 拿到 streams[]
  → LivePlayer.init({ videoEl, room })
  → player.js 内部判断：
      - Safari/iOS → 原生 HLS (video.src = url)
      - Chrome/Edge → hls.js (new Hls() → loadSource(url))
      - FLV → 提示暂未启用
```

视频流量路径：

```text
用户浏览器 ←→ pull.haioulive.com（腾讯云海外 CDN 节点）
     ↑
  （不经过香港源站服务器）
```

---

## 七、播放线路类型说明

| 类型 | 第一优先级 | 延迟 | 兼容性 | 当前阶段 |
|------|-----------|------|--------|---------|
| **HLS (m3u8)** | ✅ 主用 | 15-30s | 全平台（Safari 原生 + hls.js polyfill） | ✅ 已实现 |
| **FLV** | 预留 | 3-8s | PC 端需 flv.js（后续引入） | 按钮已展示，逻辑待补 |
| **WebRTC** | 预留 | <1s | 需信令服务器（后续评估） | 字段已预留 |

第一版只要求 HLS 稳定可播。

### 7.1 播放格式优先级策略（PC vs 手机）

| 平台 | 优先格式 | 说明 |
|------|---------|------|
| **PC Chrome / Edge** | FLV → m3u8 降级 | 优先 FLV，FLV 不可用时自动降级 m3u8 |
| **Android Chrome** | FLV → m3u8 降级 | 优先 FLV，FLV 不可用时自动降级 m3u8 |
| **iPhone / iPad Safari** | m3u8 (HLS) | Safari 原生支持 HLS，直接 `video.src` |
| **微信内置浏览器** | m3u8 (HLS) | 微信浏览器内核仅支持 HLS |
| **Safari (macOS)** | m3u8 (HLS) | 原生 HLS 支持，不依赖 hls.js |

当前阶段 FLV 和 WebRTC 已在前端 streams[] 字段中预留，后端和播放器结构无需再改。

### 7.2 StreamName 管理策略

系统支持两种 StreamName 管理模式：

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **固定 StreamName** | 每个直播间固定一个 StreamName（如 `room001`），推流端永久不变 | 主播固定直播间 |
| **按场次更换 StreamName** | 后台为每场比赛动态指定 StreamName（如 `match_20260613_001`），开播前更新 | 赛事直播按场次切换 |

后台 `PUT /admin/api/rooms/{id}/streams` 接口支持随时修改 `streamName` 和 `url` 字段，前端无需改动——只需在开播前由管理员更新该直播间对应的 m3u8/flv 地址即可。

---

## 八、可能的延迟与卡顿问题

### 8.1 现状

- 中国大陆用户 → 访问香港源站（前端页面、API）→ 延迟通常 30-80ms
- 中国大陆用户 → 拉取海外 CDN 的 `pull.haioulive.com` → 延迟取决于腾讯云海外节点覆盖

### 8.2 需实测验证

| 测试项 | 方法 | 预期 |
|--------|------|------|
| 香港 API 响应延迟 | 电信/联通/移动 分别 ping 或 curl | < 100ms 可接受 |
| m3u8 首帧时间 | Chrome DevTools Network 面板 | < 3 秒 |
| 播放卡顿率 | 5-10 分钟连续播放统计 | < 2% 卡顿 |
| 晚高峰表现 | 20:00-22:00 测试 | 是否有明显劣化 |

### 8.3 可能的优化方向（后置）

如果测试后中国大陆用户卡顿严重，可评估：

- 腾讯云国际站是否有可选的亚太优化节点
- Bunny CDN / Cloudflare Stream 等全球加速方案
- 多线路同时下发，前端选择最快的

**当前阶段结论：先以自有域名 + 腾讯云国际站海外节点测试播放效果，再决定是否需要额外 CDN。**

---

## 九、需要向腾讯云工作人员确认的问题

以下已在业务确认中得到答复：

| 问题 | 答复 |
|------|------|
| 是否需要大陆备案？ | 不需要，使用海外直播区域 |
| 是否可使用自有域名？ | 是，必须使用自有域名 |
| 推流/播放域名是否分开？ | 是，`push.haioulive.com` + `pull.haioulive.com` |
| 控制台是否可配置 CNAME？ | 是 |
| HTTPS 是否支持？ | 是，控制台可配置 |
| 播放鉴权是否必须？ | 可先关闭，稳定后开启 |
| 中国大陆用户走什么节点？ | 海外节点 |

### 待进一步确认

1. 推流地址具体格式？
2. 是否支持多码率/多分辨率推流？
3. 计费方式：按流量 / 按带宽峰值？免费测试额度？
4. m3u8 切片产生的请求数费用如何计算？

---

## 十、架构图

```text
┌─────────────┐     rtmp push      ┌──────────────────────┐
│  OBS 推流端  │ ─────────────────→ │  腾讯云国际站 /        │
│  (主播电脑)  │   push.haioulive   │  海外直播              │
└─────────────┘                    │                      │
                                   │  • 转码 HLS/FLV      │
                                   │  • 切片 .ts           │
                                   │  • 海外 CDN 分发      │
                                   └──────────┬───────────┘
                                              │
                    pull.haioulive.com         │
                    提供 m3u8/flv 播放地址      │
                    管理员填入后台             │
                                              ↓
┌─────────────────────────────────────────────────────────┐
│                    香港轻量服务器                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Nginx    │  │ API 服务  │  │ WebSocket│  │  MySQL  │ │
│  │ 静态前端  │  │ RESTful  │  │ 聊天室    │  │ 数据库   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  职责：                                                   │
│  • 前端页面 + CSS/JS 分发                                 │
│  • 后台直播源管理（保存播放地址，不下发推流地址）             │
│  • 用户登录注册                                           │
│  • 聊天室 WebSocket                                      │
│  • 赛程、广告管理                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
         HTTPS API 返回 │ streams[] 播放地址
                       ↓
┌──────────────────────────────────────────┐
│  前端浏览器 (中国大陆 / 海外用户)           │
│                                          │
│  LivePlayer (player.js)                  │
│  ├── Safari  → 原生 HLS                  │
│  ├── Chrome  → hls.js 引擎               │
│  └── 线路切换、失败重试                    │
│                                          │
│  播放源：直接请求 pull.haioulive.com      │
│  (腾讯云海外 CDN，不经过香港服务器)         │
└──────────────────────────────────────────┘
```

---

## 十一、不自建、不碰的清单

以下技术栈**明确不属于本项目范围**：

- ❌ SRS / Nginx-RTMP / LiveGo 等自建流媒体服务器
- ❌ FFmpeg 切片、转码脚本
- ❌ 自建 CDN（如 nginx-proxy-cache）
- ❌ OBS 推流地址在前端或 API 中暴露
- ❌ 直播云控制台 API 管理（后台不直接调腾讯云 API，管理员手动复制播放地址）
- ❌ 中国大陆 ICP 备案相关流程
- ❌ 自建 WebRTC 信令服务（第一版不需要）

---

## 十二、与现有 player.js 的关系

本文档不改变 `assets/js/player.js` 的任何代码逻辑。

`player.js` 的设计已经与本文档架构一致：

- ✅ 读取 `room.streams[]` 数组
- ✅ 根据 `type` 判断播放方式（hls/flv）
- ✅ 支持 `provider`、`enabled`、`default`、`priority` 字段
- ✅ 不涉及推流地址
- ✅ 不依赖任何特定直播云 SDK

streams 中新增的 `region`、`appName`、`streamName`、`authEnabled`、`remark` 字段对播放器透明，不影响播放功能。
