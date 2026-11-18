# flwfdd'Space

基于 Astro 的个人静态知识空间。内容以 Obsidian Markdown 笔记为主，支持 KaTeX、Mermaid、代码高亮、明暗主题、响应式目录和客户端时区显示。

## 技术栈

- Astro 7 + TypeScript
- Content Collections + `astro-loader-obsidian`
- Sätteri Markdown 引擎
- Tailwind CSS v4
- pnpm 12

站点输出为纯静态文件，不需要应用服务器或数据库。

## 快速开始

建议使用 Node.js 24，并通过 Corepack 使用项目声明的 pnpm 版本。

```sh
corepack enable
pnpm install
pnpm dev
```

开发服务器默认位于 [http://localhost:4321](http://localhost:4321)。

```sh
pnpm astro check  # Astro 与 TypeScript 检查
pnpm build        # 构建到 dist/
pnpm preview      # 预览生产构建
```

`dist/` 中的内容可以部署到任意静态站点托管服务。

## 添加笔记

在 `src/data/notes/` 中创建 Markdown 文件，支持中文文件名和子目录。推荐显式填写标题：

```markdown
---
title: 示例笔记
description: 一篇用于说明格式的笔记
tags: [示例]
img:
publish: true
created: 2025-09-16T18:59:11+08:00
updated: 2025-09-16T18:59:11+08:00
---

## 正文
```

时间与发布规则：

- `created`、`updated` 必须带时区，使用 ISO 8601 格式。
- 页面通过统一的 `<Time>` 组件显示时间，浏览器会按客户端时区更新。
- `publish: false` 不生成公开页面，但源文件仍能在公开仓库中看到。
- 正文中的 `#标签` 不自动转换为链接，避免代码示例被误判。
- 小型静态资源放在 `public/`；笔记封面可引用本地图片或远程地址。

完整的字段与媒体说明见 [docs/authoring.md](docs/authoring.md)。

## 项目结构

```text
src/
  components/        Astro 组件、Time、Drawer 和笔记目录
  data/notes/        Obsidian Markdown 与本地媒体
  integrations/      客户端集成
  layouts/           页面布局
  lib/               日期、目录树、路径和 Markdown 工具
  pages/             静态路由
  styles/            Tailwind 与全局样式
public/              静态资源与本地 SVG 图标
docs/                架构、写作、Markdown 与维护文档
```

## 文档

- [文档索引](docs/README.md)
- [架构与组件](docs/architecture.md)
- [笔记写作约定](docs/authoring.md)
- [Markdown 渲染管线](docs/markdown.md)
- [依赖与维护](docs/maintenance.md)

Agent 修改项目时，从 [AGENTS.md](AGENTS.md) 开始。
