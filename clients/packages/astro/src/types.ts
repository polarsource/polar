/**
 * A PolarResult contains either the data or an error from a Polar API request.
 */
export type PolarResult<T, E extends Error = Error> =
  | {
      data: T
      error: null
    }
  | {
      data: null
      error: E
    }

/**
 * An ErrorGroup is a collection of errors that are related to a single
 * operation.
 */
export class ErrorGroup<E extends Error = Error> extends Error {
  name = 'ErrorGroup'
  errors: E[]

  constructor(errors: E[], options?: ErrorOptions) {
    super(`${errors.length} errors occurred.`, options)
    this.errors = errors
  }
}

/**
 * A PolarUploadError is an error that occurs when uploading an article
 * to the Polar API.
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
export class PolarUploadError extends Error {
  name = 'PolarUploadError'
  status: number

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options)
    this.status = status
  }
}

export interface AstroCollectionEntry {
  title: string
  slug: string
  body: string
}
