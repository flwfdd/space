# Markdown 渲染管线

## Sätteri

项目使用 Astro 的 Sätteri Markdown 引擎，入口在 `astro.config.mjs`。不要改回 unified、remark 或 rehype，它们的插件与 Sätteri 不兼容。

配置分为两阶段：

- mdast：`katexPlugin`、`mermaidPlugin`
- hast：`figurePlugin`、`externalLinksPlugin`、`codeBlockPlugin`

自定义实现位于 `src/lib/markdown/satteri-plugins.ts`。

| 能力 | 实现 |
| --- | --- |
| 数学公式 | `features.math` 解析，`katexPlugin` 渲染行内与块级 KaTeX；块级公式可复制原始 LaTeX |
| Mermaid | `mermaidPlugin` 生成 `<pre class="mermaid">`，客户端动态渲染并添加复制按钮，复制内容为原始定义 |
| 图片说明 | `figurePlugin` 将纯图片段落转换为 `figure` 与 `figcaption` |
| 外部链接 | `externalLinksPlugin` 添加 `target="_blank"` 和 `rel="noopener noreferrer"` |
| 代码块 | `codeBlockPlugin` 添加纯文字语言标签，以及行号、自动换行和复制按钮；Shiki 使用 `ayu-light` / `dark-plus` 双主题，表头与代码区共用背景，不使用边框 |

## 插件 API

- mdast 插件使用 `{ name, <nodeType>(node, ctx) {} }`。
- hast 插件使用 `{ name, element: { filter: [...], visit(node, ctx) {} } }`。
- 返回新节点表示替换；`ctx.replaceNode`、`ctx.setProperty` 等用于就地修改。
- mdast 原始 HTML 使用 `{ rawHtml }`，hast 原始文本使用 `{ type: 'raw', value }`。
- `ctx.data` 是每篇文档独立的数据袋；`ctx.data.astro.frontmatter` 会暴露给页面。
- 用户 hast 插件在内置 `image-marker` 和 `heading-ids` 前运行，因此图片插件复用原 `<img>` 节点。

参考实现位于 `node_modules/@astrojs/markdown-satteri/dist/satteri-processor.js`。

## Mermaid

`src/integrations/mermaid.ts` 只注入客户端逻辑。页面没有 `pre.mermaid` 时不会加载 Mermaid 库。

- 使用 `base` 主题和项目色值，节点采用白底或深色底、细青色描边与连线，不使用 Mermaid 默认配色。
- 主题读取 `<html>` 的 `.dark` 类，描边使用 `color-mix` 引用主题色并设置透明度，避免在 Mermaid 配置中写死 RGB。
- 主题切换时保留原始定义并重新渲染。
- 渲染失败通过 DOM `textContent` 显示错误，不拼接错误 HTML。
- 大分包只服务于包含图表的页面，构建时的 chunk 提示无需通过重构消除。

代码块按钮由 `codeBlockPlugin` 输出，`MarkdownContent.astro` 统一处理行号、自动换行、复制与状态反馈。块级公式和 Mermaid 的复制按钮也由 `MarkdownContent.astro` 在客户端挂载，分别读取 KaTeX 的 `annotation` 和 Mermaid 原始定义，避免二次解析渲染结果。这两类按钮在悬停内容区域时淡显，悬停按钮本身时高亮，触屏保持可见。

## 修改后的验证

先运行：

```sh
pnpm astro check
pnpm build
```

当前公开笔记没有覆盖所有公式和 Mermaid 形态。修改插件后，还应使用 `createSatteriMarkdownProcessor` 直接渲染包含行内公式、块级公式、Mermaid、图片和外链的样例，检查实际输出，而不只检查导入或编译是否成功。
