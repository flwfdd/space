// Sätteri 自定义插件集合，替代原 unified(remark/rehype) 管线中的插件。
//
// 说明：Sätteri 使用自有的 mdast/hast visitor 体系（按节点类型订阅），与
// unified 生态不互通，因此这些插件按 Sätteri 的 API 重写：
//   - mdast 插件：对象形如 { name, <nodeType>(node, ctx) {} }
//   - hast  插件：对象形如 { name, element: { filter: string[], visit(node, ctx) } }
//   - visit/visitor 返回一个新节点即替换当前节点；ctx.replaceNode/ctx.setProperty 等做就地修改
//   - ctx.data 是「每次渲染（每篇文档）」独立的数据袋，可用于跨节点累积状态
//
// 这里全部用宽松的 any 类型：satteri 的类型定义是 astro 的传递依赖，项目根部不
// 一定能解析到，且本文件仅被 astro.config.mjs 以 JS 方式引入。

import katex from 'katex';
import { COPY_ICON } from '../copy-icon.ts';

type Ctx = any;
type Node = any;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// KaTeX 渲染：替代 remark-math + rehype-katex。
// Sätteri 通过 features.math 把 $...$ / $$...$$ 解析成 math/inlineMath 节点，
// 这里在 mdast 阶段直接渲染为 KaTeX HTML 并替换节点（KaTeX 样式已在 Layout 中引入）。
export const katexPlugin = {
  name: 'katex',
  math(node: Node, ctx: Ctx) {
    const html = katex.renderToString(node.value ?? '', { displayMode: true, throwOnError: false });
    ctx.replaceNode(node, { rawHtml: html });
  },
  inlineMath(node: Node, ctx: Ctx) {
    const html = katex.renderToString(node.value ?? '', { displayMode: false, throwOnError: false });
    ctx.replaceNode(node, { rawHtml: html });
  },
};

// Mermaid：替代 astro-mermaid 的 remark/rehype 注入。
// 把 ```mermaid 代码块替换成 <pre class="mermaid">，由客户端集成脚本负责渲染。
export const mermaidPlugin = {
  name: 'mermaid',
  code(node: Node, ctx: Ctx) {
    if (node.lang !== 'mermaid') return;
    ctx.replaceNode(node, { rawHtml: `<pre class="mermaid">${escapeHtml(node.value ?? '')}</pre>` });
  },
};

// 外链属性：替代 rehype-external-links。给绝对 http(s)/协议相对链接加 target/rel。
export const externalLinksPlugin = {
  name: 'external-links',
  element: {
    filter: ['a'],
    visit(node: Node, ctx: Ctx) {
      const href = node.properties?.href;
      if (typeof href !== 'string' || !/^(https?:)?\/\//.test(href)) return;
      ctx.setProperty(node, 'target', '_blank');
      ctx.setProperty(node, 'rel', 'noopener noreferrer');
    },
  },
};

// 图片包裹 figure/figcaption：替代 rehype-figure（保持相同 class 与结构）。
// 该 hast 插件在内置的 image-marker 之前运行，复用原 <img> 节点，保留 Astro 图片优化标记。
export const figurePlugin = {
  name: 'figure',
  element: {
    filter: ['p'],
    visit(node: Node, _ctx: Ctx) {
      const children: Node[] = node.children ?? [];
      const imgs = children.filter((c) => c.type === 'element' && c.tagName === 'img');
      if (imgs.length === 0) return;

      // 仅当段落里除图片外只有空白时才包裹，避免丢弃图文混排段落中的文字。
      const onlyImagesAndWhitespace = children.every(
        (c) =>
          (c.type === 'element' && c.tagName === 'img') ||
          (c.type === 'text' && (c.value ?? '').trim().length === 0),
      );
      if (!onlyImagesAndWhitespace) return;

      const figures = imgs.map((img: Node) => {
        const alt = img.properties?.alt;
        const figChildren: Node[] = [img];
        if (typeof alt === 'string' && alt.trim().length > 0) {
          figChildren.push({
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: [{ type: 'text', value: alt }],
          });
        }
        return {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['rehype-figure'] },
          children: figChildren,
        };
      });

      if (figures.length === 1) return figures[0];
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: ['rehype-figure-container'] },
        children: figures,
      };
    },
  },
};


function hasCodeLines(node: Node): boolean {
  return node.children?.some((child: Node) =>
    child.tagName === 'code' && child.children?.some((line: Node) => {
      const className = line.properties?.className ?? line.properties?.class;
      return line.tagName === 'span' && className?.includes('line');
    }),
  ) ?? false;
}

function codeButton(className: string, label: string, icon: string, toggle = false) {
  return {
    type: 'element',
    tagName: 'button',
    properties: {
      type: 'button',
      className: [className],
      'aria-label': label,
      title: label,
      ...(toggle ? { 'aria-pressed': 'false' } : {}),
    },
    children: [{ type: 'raw', value: icon }],
  };
}

const LINE_NUMBERS_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>';
const WRAP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M3 12h12M3 18h18"/><path d="m15 10 3 3-3 3"/><path d="M18 13H9"/></svg>';
export const codeBlockPlugin = {
  name: 'code-block',
  element: {
    filter: ['pre'],
    visit(node: Node, _ctx: Ctx) {
      const hasLines = hasCodeLines(node);
      const actions = [
        ...(hasLines ? [codeButton('code-line-number-toggle', '显示行号', LINE_NUMBERS_ICON, true)] : []),
        codeButton('code-wrap', '切换自动换行', WRAP_ICON, true),
        codeButton('code-copy', '复制代码', COPY_ICON),
      ];
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-header'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['code-language'] },
                children: [{ type: 'text', value: languageLabel(node) }],
              },
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['code-actions'] },
                children: actions,
              },
            ],
          },
          node,
        ],
      };
    },
  },
};


const LANGUAGE_LABELS: Record<string, string> = {
  astro: 'Astro',
  bash: 'Bash',
  css: 'CSS',
  html: 'HTML',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  md: 'Markdown',
  mermaid: 'Mermaid',
  python: 'Python',
  sh: 'Shell',
  ts: 'TypeScript',
  tsx: 'TSX',
};

function languageLabel(node: Node): string {
  const className = node.properties?.className;
  if (typeof className === 'string' && className.includes('mermaid')) {
    return 'Mermaid';
  }
  const language = node.properties?.dataLanguage ?? node.properties?.['data-language'] ?? 'code';
  return LANGUAGE_LABELS[language] ?? language.toUpperCase();
}
