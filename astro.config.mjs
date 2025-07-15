// @ts-check
import tailwindcss from '@tailwindcss/vite';
import mermaid from 'astro-mermaid';
import { defineConfig } from 'astro/config';
// @ts-ignore rehype-figure 的类型定义文件不存在
import rehypeFigure from 'rehype-figure';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { remarkReadingTime } from './src/lib/remark-reading-stat';

// 引入 Node.js 的 path 和 url 模块来生成绝对路径
import path from 'path';
import { fileURLToPath } from 'url';

import icon from 'astro-icon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkMath, remarkReadingTime],
    rehypePlugins: [rehypeKatex, rehypeFigure],
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