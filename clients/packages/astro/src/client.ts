import type { ConfigurationParameters } from '@polar-sh/sdk'
import { Configuration, PolarAPI } from '@polar-sh/sdk'
import type { AstroCollectionEntry } from './types'
import { PolarUploadBuilder, type UploadOptions } from './upload'

/**
 * The main entrypoint for the Astro Polar integration.
 *
 * Access the Polar SDK client via the `client` property, or use
 * other methods for easier integration with Astro.
 */
export class Polar {
  public client: PolarAPI

  constructor(config?: ConfigurationParameters) {
    this.client = new PolarAPI(new Configuration(config))
  }

  /**
   * Upload a collection of Astro articles to Polar.
   *
   * You can use the `filter` and `transform` methods to modify the articles
   * before they are uploaded.
   *
   * @example
   * ```typescript
   * import { getCollection } from 'astro:content'
   * import { Polar } from '@polar-sh/astro'
   *
   * const polar = new Polar({ accessToken: 'my-access-token' })
   * const posts = await getCollection('posts')
   *
   * const uploadResult = await polar
   *   .upload(posts, {
   *     organizationName: 'my-organization',
   *     organizationId: 'my-organization-id',
   *   })
   *   // Filter out any articles that are drafts
   *   .filter(({ entry }) => !!entry.publishedAt)
   *   // Add a custom image to the article
   *   .transform(({ article, entry }) => ({
   *     ...article,
   *     body: `![${entry.title}](${entry.featuredImage})\n\n${article.body}`,
   *   }))
   * ```
   */
  upload<TEntry extends AstroCollectionEntry>(
    entries: TEntry[],
    options: UploadOptions,
  ) {
    return new PolarUploadBuilder(this.client, entries, options)
  }
}
