// Content collection for the tool landing pages (SEO copy, how-to, FAQ, related tools).
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tools = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/tools' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().min(120).max(160),
    h1: z.string(),
    promise: z.string(),
    howTo: z.array(z.string()).min(2),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(2),
    related: z.array(z.string()).default([]),
  }),
});

export const collections = { tools };
