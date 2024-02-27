# Astro Polar Demo

This directory contains a demo site to show off the
[`@polar-sh/astro`](https://npmjs.com/package/@polar-sh/astro) package for integrating
Polar and [Astro](https://astro.build).

The site is based on the Astro blog template that ships with Astro:

```bash
pnpm create astro@latest -- --template blog
```

The only change is in the [`src/pages/blog/index.astro`](./src/pages/blog/index.astro)
file, which contains an example of how to use the integration to upload posts to Polar.

Note: this code will fail unless you provide both a personal access token and an
organization ID. The example is not intended to be run.

## Example

The following code will upload all posts to Polar that have not been uploaded
previously. It will also add the header image to the Polar post, if it exists, and will
set the title of the post. By default, the title will be the filename.

```typescript
import { getCollection } from 'astro:content'
import { Polar } from '@polar-sh/astro'

const posts = (await getCollection('blog')).sort(
  (a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
)

/**
 * Upload all posts to Polar
 */
// Create a Polar client with your API key
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
})

// Upload all posts to Polar
const { error: postUploadError } = await polar
  .upload(posts, {
    organizationId: process.env.POLAR_ORGANIZATION_ID ?? '',
    organizationName: 'polar',
  })
  // Filter for only new posts
  .filter(({ exists }) => !exists)
  // Add the correct title to the post
  .transform(({ article, entry }) => {
    article.title = entry.data.title
    return article
  })
  // Add the header image to the post
  .transform(({ article, entry }) => {
    if (entry.data.heroImage) {
      article.body = `![${entry.data.title}](${rootUrl}${entry.data.heroImage.src})\n\n${article.body}`
    }
    return article
  })

if (postUploadError) {
  console.error('Error uploading posts to Polar:', postUploadError)
}
```

The only other change has been to use an `image` in the collection config.

If you'd like to see more examples, check out
[`@polar-sh/astro` on NPM](https://npmjs.com/package/@polar-sh/astro).
