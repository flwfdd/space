# 笔记写作约定

## 文件位置

Markdown 笔记放在 `src/data/notes/`，支持中文文件名和任意层级的子目录。目录树根据笔记 ID 自动构建。

推荐显式填写 `title`，避免标题推导产生歧义。

## Frontmatter

```yaml
---
title: 示例笔记
description: 一句话说明
tags: [Agent, Astro]
img:
publish: true
created: 2025-09-16T18:59:11+08:00
updated: 2025-09-16T18:59:11+08:00
---
```

| 字段 | 约定 |
| --- | --- |
| `title` | 页面与目录中的标题，推荐显式填写 |
| `description` | 页面描述和封面下方的摘要，可留空 |
| `tags` | 字符串数组，可留空或设为 `[]` |
| `img` | 可选封面，支持笔记相对路径或远程图片 |
| `publish` | `false` 时不生成列表、目录和正文页面 |
| `created` | 创建时间，必须带时区 |
| `updated` | 更新时间，列表排序和显示使用此字段 |

Loader 会补充 `slug`、`permalink` 等字段。项目的 Zod Schema 会保留这些扩展字段。

## Gallery

Gallery 页面位于 `/gallery`，照片条目维护在 `src/data/gallery.ts`。数组顺序就是页面顺序；每张照片只需要一个 `filename` 作为稳定标识。

正式数据中，`filename` 填 ZenGallery 返回的文件名，例如 `abc123.jpg`。Space 会按标准公开接口生成：

- `https://gallery.0u0.fun/files/<filename>?level=mid`：照片墙与查看器占位图。
- `https://gallery.0u0.fun/files/<filename>?level=high`：全屏高清图。
- `https://gallery.0u0.fun/share/<filename>`：图片来源页。

也可以直接填完整 HTTP(S) URL 或站内 `/...` 路径。这类地址不经过 ZenGallery；远程地址可使用 `{width}`、`{height}`、`{quality}` 占位符生成分级图片。

照片字段：

| 字段 | 约定 |
| --- | --- |
| `filename` | ZenGallery 文件名、完整图片 URL 或站内路径，必填 |
| `title` | 照片标题，可留空 |
| `description` | 简介，可留空；支持 `[文字](链接)` 行内语法 |
| `capturedAt` | 拍摄时间，必须带时区 |
| `location` | 可省略；填写时须提供 `name`，`latitude`、`longitude`、`altitude` 可选 |
| `exif` | `camera`、`lens`、`focalLength`、`aperture`、`shutterSpeed`、`iso`，均可选 |
| `tags` | 纯字符串数组，可留空 |
| `width`、`height` | 可选，用于提前预留照片比例 |
| `size` | 可选，文件大小，单位为字节 |
| `format` | 可选，图片格式，例如 `JPEG`、`WEBP` |

照片条目类型定义在 `src/lib/gallery.ts`。不设置 `alt` 字段；页面使用标题作为 HTML `alt` 的兜底文本。来源链接由 `filename` 自动推导，不单独设置字段；其他相关链接写入 `description`。查看器按客户端时区显示拍摄时间，并单列 UTC 偏移。查看器中的“加载原图”会请求 `/files/<filename>` 并显示流式下载进度。仓库中的示例照片使用远程演示地址，前两张为本地纯色测试图；正式数据替换成 ZenGallery 文件名即可。

## 时间

统一使用带时区的 ISO 8601 时间：

```text
2025-09-16T18:59:11+08:00
```

Obsidian 模板使用：

```text
{{DATE:YYYY-MM-DD[T]HH:mm:ssZ}}
```

`Update time on edit` 插件也使用 `YYYY-MM-DD[T]HH:mm:ssZ`。不要写 `2025-09-16 18:59:11` 这类不含时区的时间。

页面显示统一使用 `src/components/Time.astro`：

```astro
<Time date={note.data.created} />
<Time date={note.data.updated} format="datetime" />
```

静态页面按 `Asia/Shanghai` 兜底，浏览器加载后按客户端时区与语言环境更新。`src/lib/date.ts` 可被其他组件复用，字符串输入必须带时区。

## 发布与隐私

`publish: false` 只控制静态页面生成，不是访问控制。仓库和 Git 历史都是公开的，私密草稿、凭据和个人资料不要放入本仓库。

正文中的 `#标签` 不自动转成链接。frontmatter 的 `tags` 仍作为笔记元数据保留。

## 图片与媒体

- 小型站点图标和通用 SVG 放在 `public/`。
- 笔记内图片可放在笔记所在目录或其 `assets/` 子目录。
- 本地封面通过 `img` 填写相对路径，支持 `jpeg`、`jpg`、`png`、`gif` 和 `webp`。
- 远程封面直接使用图片 URL。
- 栅格图片默认进入 Git LFS，`public/*.svg` 直接提交文本。
- 正文图片和 Mermaid 支持点击或按 Enter 全屏预览，可双指缩放、拖动查看，Esc 关闭；已有链接的图片保留原跳转。

## 设计规范

颜色、按钮、徽标、高亮、表单和折叠块遵循 `src/data/notes/设计系统.md`。文章中的示例与站点共用 `src/styles/design.css`，新增或修改组件时同步更新这篇文章。
