import type { AstroIntegration } from 'astro';

// 客户端渲染脚本：查找由 satteri mermaidPlugin 生成的 <pre class="mermaid">，
// 动态加载 mermaid 渲染。主题跟随本项目的 <html> 上的 .dark 类切换。
const CLIENT_SCRIPT = `
let mermaidMod;

async function renderMermaid() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (nodes.length === 0) return;

  mermaidMod ??= (await import('mermaid')).default;
  const isDark = document.documentElement.classList.contains('dark');
  mermaidMod.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });

  for (const node of nodes) {
    if (!node.dataset.diagram) node.dataset.diagram = node.textContent || '';
    const definition = node.dataset.diagram;
    const id = 'mermaid-' + Math.random().toString(36).slice(2, 11);
    try {
      const { svg } = await mermaidMod.render(id, definition);
      node.innerHTML = svg;
      node.setAttribute('data-processed', 'true');
    } catch (error) {
      node.innerHTML = '<code style="color:#e11d48">Mermaid 渲染失败: ' + (error && error.message ? error.message : error) + '</code>';
    }
  }
}

function start() { renderMermaid(); }

if (document.readyState !== 'loading') start();
else document.addEventListener('DOMContentLoaded', start);

// 仅当明暗主题真正切换时才重新渲染（避免 <html> 其他 class 变化触发全量重渲）
let wasDark = document.documentElement.classList.contains('dark');
new MutationObserver(() => {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark === wasDark) return;
  wasDark = isDark;
  renderMermaid();
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
});

// 兼容视图过渡（如果将来启用 ClientRouter）
document.addEventListener('astro:after-swap', start);
`;

// 自定义 Mermaid 集成，替代 astro-mermaid（其 remark/rehype 注入与 Sätteri 不兼容）。
// 仅负责注入客户端渲染脚本；代码块到 <pre class="mermaid"> 的转换由 satteri mermaidPlugin 完成。
export default function mermaid(): AstroIntegration {
  return {
    name: 'mermaid-client',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig }) => {
        updateConfig({ vite: { optimizeDeps: { include: ['mermaid'] } } });
        injectScript('page', CLIENT_SCRIPT);
      },
    },
  };
}
