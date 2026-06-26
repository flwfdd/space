// @ts-check
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, svgoOptimizer } from 'astro/config';

// 引入 Node.js 的 path 和 url 模块来生成绝对路径
import path from 'path';
import { fileURLToPath } from 'url';

import icon from 'astro-icon';
import mermaid from './src/integrations/mermaid';
import {
  externalLinksPlugin,
  figurePlugin,
  katexPlugin,
  mermaidPlugin,
} from './src/lib/markdown/satteri-plugins';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
  // Prerender internal links on hover so navigation feels instant (pairs with
  // experimental.clientPrerender below; browsers without Speculation Rules fall
  // back to regular prefetch).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  experimental: {
    // Editor Intellisense (autocomplete / hints) for content collection entries.
    contentIntellisense: true,
    // Client-side prerendering of prefetched links via the Speculation Rules API.
    clientPrerender: true,
    // Optimize imported SVGs at build time with SVGO.
    svgOptimizer: svgoOptimizer(),
  },
  markdown: {
    // 使用 Astro 7 原生 Markdown 引擎 Sätteri（Rust）。
    // 公式由内置 features.math 解析，配套的 mdast/hast 插件替代了原 remark/rehype 插件。
    processor: satteri({
      features: { math: true },
      // mdast 阶段：KaTeX 渲染、mermaid 代码块转换
      mdastPlugins: [katexPlugin, mermaidPlugin],
      // hast 阶段：图片包裹 figure、外链属性（在内置 image-marker 之前运行）
      hastPlugins: [figurePlugin, externalLinksPlugin],
    }),
    shikiConfig: {
      themes: {
        light: 'dark-plus',
        dark: 'dark-plus'
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  },

  integrations: [icon(), mermaid()]
});
