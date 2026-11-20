# 依赖与维护

## 日常命令

```sh
pnpm install
pnpm dev
pnpm astro check
pnpm build
pnpm preview
```

项目通过 `package.json` 的 `packageManager` 固定 pnpm 版本。需要升级包管理器时，使用 Corepack，不切换其他包管理器。

`pnpm-workspace.yaml` 只允许 `esbuild` 和 `sharp` 运行安装构建脚本。新增依赖需要额外脚本许可时，应逐项审查，不批量允许。

## 验证要求

- 代码、配置或依赖变化：`pnpm astro check && pnpm build`。
- 交互变化：在浏览器中检查桌面和移动端实际行为。
- Markdown 插件变化：直接渲染覆盖公式、Mermaid、图片和外链的样例。
- 路由或媒体变化：检查生产构建中的内部链接与资源地址。
- 时间变化：同时检查静态兜底内容、客户端时区和 `datetime` 格式。

`dist/`、`node_modules/` 和 `.astro/` 是生成内容，不进入提交。

## 当前依赖约束

### TypeScript 与 Node 类型

- TypeScript 使用 6.x；当前 `@astrojs/check` 尚不支持 TypeScript 7。
- `@types/node` 使用 24.x，与当前 Node.js 24 运行时对齐。

升级前查看 `@astrojs/check` 的 peer 范围，不为了版本数字直接越过兼容边界。

### Obsidian Loader

`astro-loader-obsidian` 0.10.0 存在三项已知情况：

1. peer 依赖仍声明 Astro 5，当前 Astro 7 的构建与类型检查已经验证，不因警告降级 Astro。
2. 运行时引用了未在自身依赖中声明的 `hast-util-from-html` 和 `hast-util-to-html`，项目已显式安装，上游补齐前不要移除。
3. 自带 Schema 使用 Zod 3，项目在 `src/content.config.ts` 中将其禁用，并改用 `astro/zod` 的 Zod 4 Schema。

正文标签链接已通过 `parseTagsIntoLinks: false` 禁用，避免代码中的颜色值和命令被误判为标签。

### Mermaid

Mermaid 12 的部分动态分包超过 500 kB，构建会显示 chunk 大小提示。这些代码只由包含图表的页面加载，不影响普通页面的首屏 JavaScript。

### PhotoSwipe

媒体预览使用 PhotoSwipe 5（MIT），首次点击时动态加载 Lightbox 和核心模块，支持触摸、滚轮和触控板缩放。

## 升级检查

1. 阅读更新日志和 peer 依赖要求，重点检查 Astro、Sätteri、Loader、Mermaid 和 TypeScript。
2. 在独立工作区升级并生成新的锁文件。
3. 运行类型检查、构建和 Markdown 样例。
4. 检查首页、笔记列表、正文、目录、抽屉、主题和客户端时间。
5. 确认文档中的版本约束仍然成立，再提交。
