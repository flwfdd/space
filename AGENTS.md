# AGENTS.md

Agent 修改本仓库前，先阅读本文件和与任务相关的 `docs/` 文档。

## 工作方式

1. 运行 `git status`，保留已有未提交修改。
2. 阅读相关源码与文档，选择能满足需求的最小实现。
3. 修改行为、结构、命令或约定时，同步更新对应文档。
4. 完成后运行 `pnpm astro check && pnpm build`。涉及页面交互时，再用浏览器验证实际效果。
5. 不提交 `dist/`、`node_modules/`、日志、临时脚本或任务报告。

## 项目边界

- 这是公开仓库，只写可公开内容。`publish: false` 只阻止生成页面，不会隐藏源码。
- 站点使用 Astro 静态输出，包管理器固定为 pnpm，不改用 npm 或 yarn。
- Markdown 使用 Sätteri，不改回 unified、remark 或 rehype。
- 优先使用 Astro、TypeScript 和原生浏览器能力。新增框架或依赖必须有现有方案无法简洁满足的需求。
- 保持严格类型，避免 `any`、HTML 字符串拼接和重复的客户端脚本。

## 实现约定速查

| 对象 | 约定 |
| --- | --- |
| 日期与时间 | 统一使用 `src/components/Time.astro`，由浏览器按客户端时区显示 |
| 移动端抽屉 | 统一使用 `src/components/layouts/Drawer.astro` 的原生 `<dialog>` |
| 笔记目录 | 使用 `src/lib/note-tree.ts` 和 `NoteTree.astro`，文件夹展开使用原生 `<details>` |
| 本地 SVG | 放在 `public/`，同时支持静态引用和 `astro-icon`；小型 SVG 不走 Git LFS |
| 模块引用 | 使用 `@/*` 映射到 `src/*` |
| 样式 | Tailwind CSS v4，配置入口为 `src/styles/global.css` |

## 文档地图

| 文档 | 何时阅读 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 修改路由、布局、组件、内容加载或渲染流程 |
| [docs/authoring.md](docs/authoring.md) | 新增或修改 Obsidian 笔记、frontmatter、时间或媒体 |
| [docs/markdown.md](docs/markdown.md) | 修改 Sätteri、KaTeX、Mermaid、图片或外链处理 |
| [docs/maintenance.md](docs/maintenance.md) | 安装、升级依赖，处理构建警告或完善验证 |

`README.md` 面向使用者，保留项目介绍和快速开始；本文件只保留 Agent 的工作入口，细节以 `docs/` 为准。
