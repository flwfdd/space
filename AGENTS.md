# AGENTS.md

面向 AI 编码助手的项目说明。修改代码前请先阅读本文件。

## 项目简介

`flwfdd'space` —— 一个基于 **Astro** 的个人知识空间 / 博客。内容以 Obsidian Markdown 笔记为主，支持数学公式、Mermaid 图、代码高亮等。站点为**纯静态输出**（`output: "static"`）。

## 技术栈

- **框架**: Astro 7（从 v5 升级而来，最新 7.x）
- **包管理器**: pnpm（见 `package.json` 的 `packageManager` 字段，**不要**改用 npm/yarn）
- **样式**: Tailwind CSS v4，通过 `@tailwindcss/vite` 插件接入（**没有** `tailwind.config.js`，配置走 CSS 优先模式，见 `src/styles/global.css`）
- **构建器**: Vite 8（随 Astro 7）
- **内容**: Content Collections + `astro-loader-obsidian`，从 `src/data/notes/` 加载 Obsidian 笔记
- **图标**: `astro-icon` + `@iconify-json/mdi`
- **图表**: Mermaid（客户端渲染，见下文）
- **Markdown 管线**: Astro 7 原生引擎 **Sätteri**（Rust，`@astrojs/markdown-satteri`），不再使用 unified/remark/rehype

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 本地开发服务器（默认 `localhost:4321`） |
| `pnpm build` | 构建到 `./dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm astro ...` | Astro CLI（如 `astro check`） |

改动配置或依赖后，用 `pnpm build` 验证（构建应输出全部页面且无报错）。

## 目录结构

```
src/
  components/             UI 组件（layouts/、notes/ 分类）
  content.config.ts       内容集合定义（notes 集合 + schema）
  data/notes/             Obsidian 笔记源文件（.md，含中文文件名与子目录）
  integrations/mermaid.ts 自定义 Mermaid 集成（注入客户端渲染脚本）
  layouts/                页面布局（Layout.astro、NotesLayout.astro）
  lib/                    工具函数
  lib/markdown/satteri-plugins.ts  Sätteri 自定义插件（见下文）
  pages/                  路由（index、about、notes/[...id]）
  styles/global.css       全局样式 + Tailwind 入口
astro.config.mjs          Astro 配置（核心，见下方注意事项）
public/                   静态资源（favicon.ico 等，不经构建处理）
```

## 约定

- **路径别名**: `@/*` 映射到 `src/*`（见 `tsconfig.json` 与 `astro.config.mjs` 的 vite alias），导入优先用 `@/...`。
- **TypeScript**: 继承 `astro/tsconfigs/strict`，保持严格类型。
- **注释/文案**: 现有代码注释多为中文，沿用即可；面向用户的文案用简体中文。
- **新增笔记**: 在 `src/data/notes/` 下放 `.md` 文件即可（支持中文名与子目录）；frontmatter 字段以 `notes` 集合 schema 为准（`tags`、`img` 等），编辑器开启 `astro.content-intellisense` 可获得补全。
- 注意 `src/lib/fotmat.ts` 是既有文件名（拼写如此），引用时勿"自动纠正"为 `format.ts`。

## Markdown 管线：Sätteri（重要）

本项目用 Astro 7 原生 **Sätteri** 引擎（`markdown.processor = satteri(...)`），**不要改回 unified/remark/rehype**。Sätteri 用自有的 mdast/hast visitor 插件体系，与 remark/rehype **不互通**。原 unified 插件已全部按 Sätteri API 重写于 `src/lib/markdown/satteri-plugins.ts`：

| 原插件 | 现替代 |
| --- | --- |
| `remark-math` | 内置 `features: { math: true }` |
| `rehype-katex` | `katexPlugin`（mdast：math/inlineMath → KaTeX HTML） |
| `rehype-figure` | `figurePlugin`（hast：`p>img` → `figure`，保留 class `rehype-figure`） |
| `rehype-external-links` | `externalLinksPlugin`（hast：外链加 target/rel） |
| `astro-mermaid` | `mermaidPlugin`（mdast：```mermaid → `<pre class="mermaid">`）+ `src/integrations/mermaid.ts`（客户端渲染脚本） |

写/改这些插件时注意 Sätteri 约定：
- mdast 插件 = `{ name, <nodeType>(node, ctx) {} }`；hast 插件 = `{ name, element: { filter: [...], visit(node, ctx) } }`。
- visit 返回新节点即**替换**当前节点；`ctx.replaceNode/setProperty/wrapNode` 做就地修改；raw HTML 用 `{ rawHtml }`(mdast) 或 `{ type:'raw', value }`(hast)。
- `ctx.data` 是**每篇文档**独立的数据袋；写入 `ctx.data.astro.frontmatter` 的字段会通过 `render()` 的 `remarkPluginFrontmatter` 暴露给页面。
- 用户 hast 插件在内置 `image-marker`/`heading-ids` **之前**运行，所以 `figurePlugin` 复用原 `<img>` 节点即可保留 Astro 图片优化标记。
- 关键参考实现：`node_modules/@astrojs/markdown-satteri/dist/satteri-processor.js`（内置插件写法）。
- 改完插件后无法靠现有笔记验证 math/mermaid（内容里暂时没有），用一个独立脚本调 `createSatteriMarkdownProcessor` 渲染样例来测。

Mermaid：主题跟随 `<html>` 上的 `.dark` 类（**不是** `data-theme`），客户端脚本里据此切换 mermaid 主题；`pre.mermaid` 的 prose 代码块底色已在 `global.css` 覆盖。

其他配置注意：
- **`compressHTML` 用 v7 默认 `'jsx'`**（按 JSX 规则去空白）：相邻内联元素间空格可能被吃掉，若发现缺空格用 `{" "}` 显式补；想恢复旧行为设 `compressHTML: true`。
- **实验性特性**已启用：`contentIntellisense`、`clientPrerender`（配合 `prefetch`）、`svgOptimizer`。不保证稳定，升级 Astro 时留意 changelog。

## 已知风险

- `astro-loader-obsidian` 的 peer 依赖声明仍停留在 Astro 5，`pnpm install` 会有 peer 警告。运行时正常，**不要为消警告而降级 Astro**。
- 构建时有一条 "loader's schema is defined using a function" 警告，来自 `astro-loader-obsidian` 内部（非本项目配置）；因 `content.config.ts` 自带 schema，目前无影响，等该 loader 适配 v7 后再升级它。
