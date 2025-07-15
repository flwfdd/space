// 1. 从 `astro:content` 导入工具函数
import { ObsidianDocumentSchema, ObsidianMdLoader } from 'astro-loader-obsidian';
import { defineCollection, z } from 'astro:content';

// 2. 导入加载器

// 3. 定义你的集合
const notes = defineCollection({
	loader: ObsidianMdLoader({
		base: 'src/data/notes',
		removeH1: false,
	}),
	schema: () => ObsidianDocumentSchema.extend({
		img: z.string().optional(),
	}),
});

// 4. 导出一个 `collections` 对象来注册你的集合
export const collections = { notes };