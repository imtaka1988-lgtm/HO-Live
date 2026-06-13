# 海鸥直播 — 后台 API 契约文档

> 版本：V4.5
> 更新时间：2026-06-12
> 配套文档：[docs/live-cloud-integration.md](live-cloud-integration.md)

---

## 架构概述

```
香港服务器（本项目）：
  前端页面 + 后台管理 + API + 数据库 + 用户 + 聊天室
  只保存播放地址，不做切片/转码/CDN

腾讯云国际站 / 海外直播：
  OBS 推流（push.haioulive.com）→ 转码 HLS/FLV → CDN 分发（pull.haioulive.com）

前端直播间：
  按 roomId 请求 API 获取 streams[] → hls.js 播放 → 直接拉取腾讯云 CDN
```

**核心安全原则：**
- 前端 API 只下发播放地址（`url` 字段）
- 推流地址（`rtmp://push.haioulive.com/live/...`）永远不下发到前端
- `txSecret` / `txTime` / `pushDomain` 仅后台管理接口可见
- 播放鉴权开启后，后端负责拼接完整鉴权 URL 再下发

当前阶段数据来自 `assets/data/site-config.json`，正式上线后切换为以下接口。

---

## 一、站点配置

```http
GET /api/site/config
```

**响应示例：**

```json
{
  "brand": {
    "name": "海鸥直播",
    "domain": "www.haiou.live",
    "logo": "/assets/img/logo.svg",
    "slogan": "高清免费 体育直播",
    "appName": "海鸥直播",
    "version": "V1.0"
  },
  "theme": {
    "cssVars": {
      "--brand-yellow": "#ffc21a",
      "--brand-dark": "#242745"
    }
  },
  "links": {
    "androidApk": "#",
    "iosApp": "#",
    "backupDomains": ["haiou36.com", "haiou37.com"]
  },
  "liveCloud": {
    "provider": "tencent-intl",
    "regionMode": "overseas",
    "requiresIcp": false,
    "pushDomain": "push.haioulive.com",
    "pullDomain": "pull.haioulive.com",
    "appName": "live"
  }
}
```

> 注意：`liveCloud.pushDomain` 仅用于后台管理展示，前端请求时建议过滤此字段。

---

## 二、直播间列表

```http
GET /api/rooms?category=football
```

返回直播间卡片数据：标题、封面、主播、观看人数、播放地址、是否直播中。

**响应示例：**

```json
[
  {
    "id": 1,
    "category": "football",
    "title": "午后聊球",
    "subTitle": "足球赛事精选",
    "host": { "name": "车太勤", "avatar": "/assets/img/host-1.svg", "level": "Lv.5" },
    "cover": "/assets/img/thumb-1.svg",
    "poster": "/assets/img/thumb-1.svg",
    "viewers": "6.22万",
    "quality": "高清",
    "status": "live",
    "sort": 1,
    "streamUrl": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    "streams": [
      {
        "name": "腾讯云HLS线路",
        "type": "hls",
        "url": "https://pull.haioulive.com/live/room001.m3u8",
        "provider": "tencent-intl",
        "enabled": true,
        "default": true,
        "priority": 1
      }
    ]
  }
]
```

> `streamUrl` 字段保留后向兼容。列表接口中 streams 可只返回 1 条默认线路，详情接口返回完整列表。

---

## 三、直播间详情

```http
GET /api/rooms/{id}
```

返回直播间基础信息、播放线路、主播资料、公告。

**响应中 streams 完整字段说明：**

| 字段 | 类型 | 前端可见 | 说明 |
|------|------|---------|------|
| `name` | string | ✅ | 线路名称（如"腾讯云HLS线路"） |
| `type` | string | ✅ | 播放类型：`hls` / `flv` / `webrtc` |
| `url` | string | ✅ | 播放地址 |
| `provider` | string | ✅ | 来源：`tencent-intl` / `backup` / `bunny` |
| `enabled` | boolean | ✅ | 是否启用 |
| `default` | boolean | ✅ | 是否默认线路 |
| `priority` | number | ✅ | 排序优先级（1 最高） |
| `region` | string | ✅ | 区域：`overseas` / `asia` |
| `remark` | string | ✅ | 备注说明 |
| `appName` | string | ❌ 仅后台可见 | 直播云 AppName |
| `streamName` | string | ❌ 仅后台可见 | 直播云 StreamName |
| `authEnabled` | boolean | ❌ 仅后台可见 | 是否开启播放鉴权 |
| `pushDomain` | string | ❌ 仅后台可见 | 推流域名 |
| `pullDomain` | string | ❌ 仅后台可见 | 播放域名 |
| `txSecret` | string | ❌ 仅后台可见 | 鉴权密钥 |
| `txTime` | string | ❌ 仅后台可见 | 鉴权有效期 |

**播放线路类型：**

| 类型 | 阶段 | 说明 |
|------|------|------|
| `hls` | ✅ 第一阶段主用 | Safari 原生 + hls.js polyfill |
| `flv` | 预留 | PC 端按钮已展示，点击提示"暂未启用" |
| `webrtc` | 预留 | 字段已预留，后续评估 |

---

## 四、播放源管理接口（核心）

```http
PUT /admin/api/rooms/{id}/streams
```

后台管理员通过此接口填写腾讯云国际站提供的 m3u8/flv 播放地址。

**请求体：**

```json
{
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
      "remark": "PC端 FLV 备用线路"
    }
  ]
}
```

**关键约束：**

1. 此接口只管理播放地址，不涉及推流地址
2. 推流地址（`rtmp://push.haioulive.com/live/...`）由管理员在腾讯云控制台获取后填入 OBS
3. 前端永远不接收 `pushDomain`、`txSecret`、`txTime`
4. 如果后期开启播放鉴权，后端在返回给前端前拼接完整鉴权 URL

---

## 五、赛程列表

```http
GET /api/matches?date=2026-06-12&sport=football
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `roomId` | number | 关联的直播间 ID（兼容旧数据） |
| `boundRoomId` | number | **推荐使用** — 赛程绑定的直播间 ID，优先于 `roomId` |
| `status` | string | `直播中` / `未开始` / `预约` / `已结束` |
| `sort` | number | 排序值 |

`boundRoomId` 优先于 `roomId`。`roomId` 保留兼容，不删除。

**响应示例：**

```json
[
  {
    "id": 101,
    "league": "午后聊球",
    "sport": "football",
    "time": "14:00",
    "day": "今天",
    "home": "午后聊球",
    "away": "午后聊球",
    "homeLogo": "/assets/img/team-1.svg",
    "awayLogo": "/assets/img/team-1.svg",
    "status": "直播中",
    "hosts": ["h2", "h1", "h3"],
    "roomId": 1,
    "boundRoomId": 1
  }
]
```

---

## 六、广告列表

```http
GET /api/ads?position=home_side
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `position` | string | 广告位置：`home_side` / `home_banner` / `mobile_banner` / `mobile_float` / `room_side` / `app_banner` |
| `enabled` | boolean | 是否启用 |
| `sort` | number | 排序值（越小越靠前） |
| `image` | string | 广告图片 URL |
| `href` | string | 点击跳转链接 |

---

## 七、登录与用户

```http
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/user/profile
PUT  /api/user/profile
```

当前阶段为占位接口。前端登录页和我的页已预留静态 UI，后续对接 JWT/Token。

---

## 八、关注与预约

```http
POST   /api/user/follow/{roomId}
DELETE /api/user/follow/{roomId}
GET    /api/user/follows
```

```http
POST   /api/user/reserve/{scheduleId}
DELETE /api/user/reserve/{scheduleId}
GET    /api/user/reserves
```

当前阶段为占位接口。前端关注页已预留 UI（未登录引导 + 推荐列表）。

---

## 九、聊天室 WebSocket

```text
wss://你的域名/ws/chat?roomId=1&token=xxx
```

**消息格式（客户端 → 服务端）：**

```json
{
  "type": "message",
  "roomId": 1,
  "text": "下午好"
}
```

**消息格式（服务端 → 客户端）：**

```json
{
  "type": "message",
  "roomId": 1,
  "user": "用户昵称",
  "level": "Lv.5",
  "text": "下午好"
}
```

当前阶段前端聊天区使用静态 mock 数据。后续对接真实 WebSocket。

---

## 十、后台管理 CRUD

```http
# 直播间管理
GET    /admin/api/rooms
POST   /admin/api/rooms
PUT    /admin/api/rooms/{id}
DELETE /admin/api/rooms/{id}

# 赛程管理
GET    /admin/api/matches
POST   /admin/api/matches
PUT    /admin/api/matches/{id}
DELETE /admin/api/matches/{id}

# 广告管理
GET    /admin/api/ads
POST   /admin/api/ads
PUT    /admin/api/ads/{id}
DELETE /admin/api/ads/{id}

# 播放源管理（核心）
PUT    /admin/api/rooms/{id}/streams
```

---

## 十一、后向兼容

以下字段在生产环境中保留兼容，暂不删除：

| 字段 | 位置 | 替代字段 | 说明 |
|------|------|---------|------|
| `streamUrl` | rooms | `streams[0].url` | 旧版单线路播放地址 |
| `roomId` | matches | `boundRoomId` | 旧版赛程-直播间关联 |
| `mobileFloat` (string) | ads | `mobileFloat.text` | 旧版移动端浮动广告文案 |

---

## 十二、与前端代码的对应关系

| API | 前端模块 | 兜底逻辑 |
|-----|---------|---------|
| `GET /api/site/config` | `config.js` → `loadConfig()` | `site-config.json` |
| `GET /api/rooms` | `rooms.js` → `renderHome()` / `renderLive()` | `state.cfg.rooms` |
| `GET /api/rooms/{id}` | `router.js` → `renderRoom()` | `state.cfg.rooms.find()` |
| `GET /api/matches` | `schedule.js` → `renderSchedule()` | `state.cfg.matches` |
| `GET /api/ads` | `ui.js` → `renderGlobalChrome()` | `state.cfg.ads` |
| `WebSocket /ws/chat` | `chat.js` → `initChatSocket()` | `state.cfg.chat`（静态） |
