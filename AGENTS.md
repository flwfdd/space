# AGENTS.md

面向 AI 编码助手的项目说明。修改代码前请先阅读本文件。

## 项目简介

`flwfdd'space` —— 一个基于 **Astro** 的个人知识空间 / 博客。内容以 Obsidian Markdown 笔记为主，支持数学公式、Mermaid 图、代码高亮等。站点为**纯静态输出**（`output: "static"`）。

## 技术栈

- **框架**: Astro 7（从 v5 升级而来，最新 7.x）
- **包管理器**: pnpm 12（见 `package.json` 的 `packageManager` 字段，**不要**改用 npm/yarn）
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
| `pnpm astro check` | Astro 与 TypeScript 类型检查 |

改动配置或依赖后，用 `pnpm astro check && pnpm build` 验证（类型检查应通过，构建应输出全部页面且无报错）。

## 目录结构

```
src/
  components/             UI 组件（layouts/、notes/ 分类；Drawer 为统一移动端抽屉）
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
- **新增笔记**: 在 `src/data/notes/` 下放 `.md` 文件即可（支持中文名与子目录）；frontmatter 字段以 `notes` 集合 schema 为准（`tags`、`img` 等），编辑器开启 `astro.content-intellisense` 可获得补全。`publish: false` 只阻止页面生成，源文件在公开仓库中仍可见。正文中的 `#标签` 不自动转换成链接，避免代码示例中的 `#` 被误判为标签。
- **笔记时间**: `created`、`updated` 使用带时区的 ISO 8601 格式，例如 `2025-09-16T18:59:11+08:00`。Obsidian 模板格式为 `{{DATE:YYYY-MM-DD[T]HH:mm:ssZ}}`。需要显示时间时统一使用 `src/components/Time.astro`：静态内容按 `Asia/Shanghai` 兜底，浏览器再按客户端时区与语言环境更新；`format="datetime"` 可显示日期和时间。`src/lib/date.ts` 同时提供服务端和客户端格式化，传入字符串时必须带时区。
- **移动端抽屉**: 统一使用 `src/components/layouts/Drawer.astro` 的原生 `<dialog>` 实现，不为单个抽屉另写遮罩和开关脚本。
- **本地 SVG**: 放在 `public/`，既可作为静态资源引用，也可通过 `astro-icon` 使用；小型 SVG 不进入 Git LFS。
- **笔记目录**: `src/lib/note-tree.ts` 定义文件／文件夹联合类型，`src/components/notes/NoteTree.astro` 递归渲染目录。文本通过 Astro 元素输出，不使用 HTML 字符串拼接或 `set:html`；文件夹展开使用原生 `<details>`，不另写目录脚本。

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

- `astro-loader-obsidian` 0.10.0 的 peer 依赖声明仍停留在 Astro 5，`pnpm install` 会有 peer 警告。当前 Astro 7 构建与类型检查正常，**不要为消警告而降级 Astro**。
- Loader 0.10.0 未声明其运行时引用的 `hast-util-from-html` 和 `hast-util-to-html`，项目已显式添加这两个依赖；上游补齐前不要移除。Loader 自带的 Zod 3 Schema 已禁用，`src/content.config.ts` 使用 `astro/zod` 的 Zod 4 Schema 声明项目字段，升级 Loader 后需要重新验证内容同步。
- Mermaid 12 的部分动态分包超过 500 kB，构建会提示 chunk 大小。只有含 Mermaid 图的页面会加载这些分包，不要为了消除提示拆散自定义集成。
