import { defineCollection, z } from 'astro:content';
import { polarArticleSchema } from '@polar-sh/astro';

const blog = defineCollection({
  type: 'content',
  // Type-check frontmatter using a schema
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image().optional(),
    polar: polarArticleSchema.optional(),
  }),
});

export const collections = { blog };
