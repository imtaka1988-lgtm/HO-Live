# 后续品牌与样式调整位置

## 1. 改品牌和 Logo

文件：`assets/data/site-config.json`

```json
"brand": {
  "name": "海鸥直播",
  "domain": "www.haiou.live",
  "logo": "assets/img/logo.svg"
}
```

替换 Logo 时，把图片放到：

```text
assets/img/your-logo.png
```

然后把 `logo` 改成：

```json
"assets/img/your-logo.png"
```

## 2. 改颜色

优先改：`assets/data/site-config.json` 里的：

```json
"theme": {
  "cssVars": {
    "--brand-yellow": "#ffc21a"
  }
}
```

也可以改：`assets/css/site.css` 顶部的 `:root`。

## 3. 改直播源

文件：`assets/data/site-config.json`

每个直播间有：

```json
"streamUrl": "https://你的CDN/live/room1.m3u8"
```

换成腾讯云、Bunny、SRS 或其他 CDN 的 m3u8 地址即可。

## 4. 改页面细节

主要文件：

```text
assets/css/site.css
assets/js/site.js
```

建议保留配置层，不要把颜色写死在 HTML 里。
