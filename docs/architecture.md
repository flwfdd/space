# 架构与组件

## 总体结构

Space 是 Astro 静态站点。构建时生成全部 HTML、CSS、JavaScript 和媒体，运行时不依赖 Node.js 服务或数据库。

笔记的主要流程：

```text
Obsidian Markdown
  → astro-loader-obsidian 读取文件与 frontmatter
  → src/content.config.ts 使用 Zod 4 校验项目字段
  → getCollection 读取并过滤 publish: false
  → Sätteri 渲染正文
  → Astro 生成静态页面
```

`src/content.config.ts` 显式禁用 Loader 自带的 Zod 3 Schema，并使用 `astro/zod` 声明项目需要的字段。扩展字段通过 `.loose()` 保留。

## 路由

| 路由 | 实现 | 职责 |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | 首页 |
| `/about` | `src/pages/about.astro` | 关于页 |
| `/notes` | `src/pages/notes/index.astro` | 按更新时间排序的笔记列表 |
| `/notes/[...id]` | `src/pages/notes/[...id].astro` | 笔记正文、封面、日期和目录 |

`src/layouts/Layout.astro` 提供页面元信息、主题初始化和整体布局。`NotesLayout.astro` 增加笔记目录、大纲及移动端抽屉。

## 客户端交互

项目不设置全局 hydration 框架，交互使用原生浏览器能力：

- `Drawer.astro`：使用 `<dialog>` 实现菜单、目录和大纲抽屉，统一处理 Escape、遮罩、焦点、关闭按钮和背景滚动。
- `NoteTree.astro`：递归渲染目录树，使用 `<details>` 展开文件夹，不需要目录脚本。
- `Time.astro`：输出语义化 `<time>`，静态内容按 `Asia/Shanghai` 兜底，随后由浏览器按客户端时区更新。
- `ThemeToggle.astro`：处理 system、light、dark 三种状态；未存储偏好时视为 system。
- `integrations/mermaid.ts`：仅在页面存在 Mermaid 代码块时动态加载渲染器。

## 笔记目录

`src/lib/note-tree.ts` 定义目录数据：

```ts
type NoteNode =
  | { type: "file"; name: string; title: string; note: NoteEntry }
  | { type: "folder"; name: string; children: NoteTree };
```

`NoteTree.astro` 递归输出 `<ul>`、`<li>`、`<details>` 和链接。文本由 Astro 自动转义，不使用 `set:html`。当前目录自动展开，当前笔记通过 `aria-current="page"` 标识。

## 样式与静态资源

- Tailwind CSS v4 通过 `@tailwindcss/vite` 接入，配置入口为 `src/styles/global.css`。
- `src/styles/design.css` 定义语义色、表面、文字、边线及基础组件样式。`src/data/notes/设计系统.md` 是面向使用者与 Agent 的设计规范，示例使用同一套样式。
- `public/` 中的文件原样复制到构建产物，小型 SVG 同时作为 `astro-icon` 的本地图标。
- 栅格图片、音频、视频和 PDF 默认使用 Git LFS；`public/*.svg` 直接由 Git 管理。
- 路径别名 `@/*` 指向 `src/*`。
