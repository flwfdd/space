import { ObsidianMdLoader } from "astro-loader-obsidian";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const loader = {
  ...ObsidianMdLoader({
    base: "src/data/notes",
    removeH1: false,
    parseTagsIntoLinks: false,
  }),
  schema: undefined,
};

const notes = defineCollection({
  loader,
  schema: z
    .object({
      title: z.string(),
      slug: z.string(),
      permalink: z.string(),
      description: z.string().optional(),
      publish: z.boolean().optional(),
      created: z.date(),
      updated: z.date(),
      tags: z.array(z.string()).nullish(),
      img: z.string().nullish(),
    })
    .loose(),
});

export const collections = { notes };