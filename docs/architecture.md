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
| `/gallery` | `src/pages/gallery.astro` | 照片墙与照片查看器 |
| `/notes` | `src/pages/notes/index.astro` | 按更新时间排序的笔记列表 |
| `/notes/[...id]` | `src/pages/notes/[...id].astro` | 笔记正文、封面、日期和目录 |

`src/layouts/Layout.astro` 提供页面元信息、主题初始化和整体布局。`NotesLayout.astro` 增加笔记目录、大纲及移动端抽屉。

## 客户端交互

项目不设置全局 hydration 框架，交互使用原生浏览器能力：

- `Drawer.astro`：使用 `<dialog>` 实现菜单、目录和大纲抽屉，统一处理 Escape、遮罩、焦点、关闭按钮和背景滚动。`showHeader={false}` 隐藏标题栏和分隔线，关闭按钮悬浮在右上角。
- `NoteTree.astro`：递归渲染目录树，使用 `<details>` 展开文件夹，不需要目录脚本。
- `Time.astro`：输出语义化 `<time>`，静态内容按 `Asia/Shanghai` 兜底，随后由浏览器按客户端时区更新。
- `ThemeToggle.astro`：处理 system、light、dark 三种状态；未存储偏好时视为 system。
- `integrations/mermaid.ts`：仅在页面存在 Mermaid 代码块时动态加载渲染器。
- `media-preview.ts`：统一处理正文图片和 Mermaid 的点击及键盘预览入口；`media-lightbox.ts` 在首次点击时加载 PhotoSwipe，复用现有图片和渲染后的 SVG。
- `image-viewer.ts`：Gallery 与笔记共用的 PhotoSwipe 基础层，统一开合动画、缩略图交接、缩放按钮、控件自动隐藏和焦点保护；`image-viewer-launch.ts` 合并加载期间的重复点击，两个入口只负责收集各自的数据与专用界面。
- `gallery-client.ts`：只在 Gallery 页面绑定照片入口，首次点击加载 PhotoSwipe；加载过程中合并重复点击，避免跳转到原图。照片墙保留图片比例，悬停或键盘聚焦时只将裁切框内的图片放大至 101.5%，外框保持不变，并显示标题、简介、地点和标签，日期位于右下角；按下时保留轻微缩小反馈。
- `gallery-lightbox.ts`：查看器用中清图作占位、高清图作正式内容。宽度至少 800px 且横屏时，信息默认展开为右侧栏；其他尺寸使用可下拉关闭的底部抽屉。竖屏展开时，图片、控件和左下信息在同一层同步上移并缩小，背景保持铺满。面板动画从当前画面继续，图片布局动画将屏幕坐标换算到 PhotoSwipe 的缩放坐标，拖动把手直接跟随指针；旋转屏幕会清除旧方向的动画。面板关闭后将焦点还给信息按钮。
- Gallery 和笔记图片展开为 320ms，收回为 400ms，两者共用 `cubic-bezier(0.1, 1, 0.2, 1)` 强减速曲线：起步迅速完成大部分位移，随后缓慢落位，无过冲或回弹。展开时复用缩略图作占位，临时隐藏下方原图，避免出现两份图片；收回时同样隐藏原图，结束后恢复。Gallery 以固定裁切框测量缩略图位置，竖屏收回坐标包含舞台缩放和位移，背景用当前照片双层交叉淡化。减少动态效果时停用动画。无操作时隐藏控件和 Gallery 左下信息，键盘聚焦的控件保持可见。
- `gallery-info.ts` 负责照片说明、元数据和原图按钮的 DOM 渲染。原图通过流式 `fetch` 加载并显示下载进度，切图或关闭时用 `AbortController` 取消未完成请求。图片解码成功后通过 `refreshSlideContent` 更新内容和真实尺寸，并保留当前缩放与位置；同一张照片只更新图片和按钮状态，保留信息面板、焦点及背景。已加载原图的对象 URL 在本次查看期间持续有效，查看器销毁时统一释放，同时取消监听器和计时器。

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
- `src/styles/design.css` 定义语义色、表面、文字、边线、基础组件和 Markdown 正文样式。`heading-1`、`heading-2` 等通用类可全局复用，`.prose` 规则仅作用于 Markdown 正文。`src/data/notes/设计系统.md` 是面向使用者与 Agent 的设计规范，示例使用同一套样式。
- `src/styles/gallery.css` 只由 Gallery 页面导入，包含照片墙和查看器样式，复用全站设计 token。
- `src/styles/image-viewer.css` 随共用查看器按需加载，统一控件外观与过渡；`media-lightbox.css` 仅负责笔记预览的页面模糊背景。
- `MarkdownContent.astro` 负责正文容器、复制按钮和媒体预览初始化。
- `public/` 中的文件原样复制到构建产物，小型 SVG 同时作为 `astro-icon` 的本地图标。
- 栅格图片、音频、视频和 PDF 默认使用 Git LFS；`public/*.svg` 直接由 Git 管理。
- 路径别名 `@/*` 指向 `src/*`。
