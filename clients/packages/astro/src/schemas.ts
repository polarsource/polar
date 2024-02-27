import { z } from 'zod'

/**
 * A useful Zod schema for adding Polar article metadata to your
 * Astro content collection frontmatter config. All properties are
 * optional.
 *
 * @example
 * ```typescript
 * import { defineCollection } from 'astro:content'
 * import { polarArticleSchema } from '@polar-sh/astro'
 * defineCollection({
 *    schema: z.intersection(polarArticleSchema, z.object({
 *      // Your custom frontmatter properties here
 *    })),
 * })
 */
export const polarArticleSchema = z.object({
  /**
   * The title of the article on Polar
   */
  title: z.string(),
  /**
   * Whether the article is public, hidden, or private
   */
  visibility: z.enum(['public', 'hidden', 'private']),
  /**
   * Whether the article is for paid subscribers only
   */
  paid_subscribers_only: z.boolean(),
  /**
   * The date the article was published. Set to a future date to schedule
   * the article to be published at a later time
   */
  published_at: z.coerce.date(),
  /**
   * Whether to notify subscribers of the new article
   */
  notify_subscribers: z.boolean(),
  /**
   * Whether the article is pinned to the top of your profile
   */
  is_pinned: z.boolean(),
}).partial()

