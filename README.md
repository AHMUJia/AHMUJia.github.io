# 个人博客（静态版）

这是一套**可直接打开**的个人博客静态站点（临床医生 & 医学研究者风格），已根据你的 CV 信息做了首页文案与研究方向结构。

## 如何预览

### 方式 A：直接打开（推荐先这样）

双击打开 `index.html` 即可。

> 说明：文章列表使用 `posts-data.js` 加载，确保在 `file://` 模式也能显示，无需本地服务器。

### 方式 B：本地起一个静态服务器（更接近线上效果）

在当前目录打开终端后执行：

```bash
python -m http.server 5173
```

然后用浏览器访问：`http://localhost:5173`

## 目录结构

- `index.html`：主页（简介 + 研究方向 + 基金 + 最近博客 + 联系方式）
- `research.html`：研究方向页面
- `publications.html`：论文/成果页面（节选示例，可继续补全）
- `blog.html`：博客列表页
- `posts/`：文章页面（HTML）
- `posts-data.js`：文章索引（用于直接打开页面时渲染列表）
- `posts.json`：文章索引（备用，方便未来部署到 http/https 后用 fetch 渲染）
- `styles.css`：全站样式（含深浅色主题）
- `script.js`：主题切换、年份、文章列表渲染
- `LXH_9648.jpg`：头像/形象照（当前直接引用此文件）
- `assets/favicon.svg`：站点图标

## 如何新增一篇文章

1. 在 `posts/` 新建一个 HTML（可以复制 `posts/2026-01-31-about.html` 改内容）
2. 在 `posts-data.js` 里追加一条 `window.__POSTS__` 记录
3. （可选）也在 `posts.json` 里追加同样的一条，保持两者同步

## 如何替换头像/改文案

- **换头像**：替换 `LXH_9648.jpg` 文件，或把新图片放进来后修改 `index.html` 里 `<img class="portrait" ... />` 的路径
- **改邮箱/电话**：修改 `index.html` 中 `mailto:` 与 `tel:` 链接即可
- **改主题色**：在 `styles.css` 顶部的 `--brand` / `--brand2` 改颜色

