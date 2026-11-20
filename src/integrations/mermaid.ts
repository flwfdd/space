import type { AstroIntegration } from 'astro';

// 客户端渲染脚本：查找由 satteri mermaidPlugin 生成的 <pre class="mermaid">，
// 动态加载 mermaid 渲染。主题跟随本项目的 <html> 上的 .dark 类切换。
const CLIENT_SCRIPT = `
let mermaidMod;
function mermaidConfig(isDark) {
  return {
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      fontFamily: 'Noto Sans SC, sans-serif',
      fontSize: '14px',
      primaryColor: isDark ? '#083344' : '#ffffff',
      primaryTextColor: isDark ? '#ecfeff' : '#164e63',
      secondaryColor: isDark ? '#00161c' : '#ffffff',
      tertiaryColor: isDark ? '#00161c' : '#ffffff',
      mainBkg: isDark ? '#083344' : '#ffffff',
      secondBkg: isDark ? '#00161c' : '#ffffff',
      clusterBkg: isDark ? '#00161c' : '#ffffff',
      clusterBorder: isDark ? '#155e75' : '#e5e7eb',
      edgeLabelBackground: isDark ? '#083344' : '#ffffff',
      textColor: isDark ? '#ecfeff' : '#164e63',
      actorTextColor: isDark ? '#ecfeff' : '#164e63',
      signalTextColor: isDark ? '#ecfeff' : '#164e63',
    },
    themeCSS: \`
      .node rect, .node polygon { stroke-width: 1px; rx: 6px; ry: 6px; }
      .node text { font-weight: 400; }
      .edgePath .path, .marker { stroke-width: 1.25px; }
    \`,
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      padding: 12,
      nodeSpacing: 40,
      rankSpacing: 50,
      useMaxWidth: true,
    },
  };
}

async function renderMermaid() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (nodes.length === 0) return;

  try {
    mermaidMod ??= (await import('mermaid')).default;
  } catch (error) {
    for (const node of nodes) {
      const code = document.createElement('code');
      code.textContent = 'Mermaid 加载失败: ' + (error && error.message ? error.message : error);
      node.replaceChildren(code);
    }
    return;
  }
  const isDark = document.documentElement.classList.contains('dark');

  for (const node of nodes) {
    if (!node.dataset.diagram) node.dataset.diagram = node.textContent || '';
    const definition = node.dataset.diagram;
    const id = 'mermaid-' + Math.random().toString(36).slice(2, 11);
    try {
      mermaidMod.initialize(mermaidConfig(isDark));
      const { svg } = await mermaidMod.render(id, definition);
      node.innerHTML = svg;
      node.setAttribute('data-processed', 'true');
    } catch (error) {
      const code = document.createElement('code');
      code.style.color = '#e11d48';
      code.textContent = 'Mermaid 渲染失败: ' + (error && error.message ? error.message : error);
      node.replaceChildren(code);
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
