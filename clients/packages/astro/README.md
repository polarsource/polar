# Polar Astro SDK

The Polar Astro SDK is an Astro library designed for interacting with the
[Polar](https://polar.sh) API.

The SDK is designed to run in both static and SSR mode, and provides wrappers the
[`@polar-sh/sdk`](https://www.npmjs.com/package/@polar-sh/sdk) package for integrating
your Astro site with Polar.

## Usage

Install the SDK with your favourite package manager (ours is PNPM!):

```bash
pnpm add @polar-sh/astro
```

Then, get started by creating a Polar client with your access token:

```typescript
import { Polar } from '@polar-sh/astro'

const polar = new Polar({ accessToken })
```

Access tokens can be generated on your Polar [Settings page](https://polar.sh/settings).

### Uploading posts to Polar

The upload module is designed to be used with
[Astro content collections](https://docs.astro.build/en/guides/content-collections/).

The upload client uses the builder pattern to transform and filter posts before
uploading them to Polar. For example, to upload all your posts with no modification:

```typescript
import { getCollection } from 'astro:content'
import { Polar } from '@polar-sh/astro'

const posts = await getCollection('blog')

const polar = new Polar({ accessToken })

const { data, error } = await polar.upload(posts, {
  organizationId,
  organizationName,
})
```

Both `organizationId` and `organizationName` are required fields. The returned `data`
will contain two arrays: one for newly-created posts, and one for updated posts.

The `error` property of the response will contain either an error or a group of errors.

`data` and `error` are mutually exclusive.

The Polar upload builder includes functions for transforming and filtering your posts
before they're uploaded.

#### Examples

##### Filter existing posts

Only upload new posts that haven't previously been uploaded to Polar. Posts are
deduplicated by slug.

```typescript
const { data, error } = await polar
  .upload(posts, {
    organizationId,
    organizationName,
  })
  .filter(({ exists }) => !exists)
```

##### Add a title to the posts

This assumes you have a title in your content collection frontmatter.

```typescript
const { data, error } = await polar
  .upload(posts, {
    organizationId,
    organizationName,
  })
  .transform(({
    // `entry` is the Astro collection entry
    entry,
    // `article` is the Polar article
    article,
  }) => {
     article.title = entry.data.title
     return article
  })
```

##### Update existing posts with new hero images

If you have hero images on your
[Astro collection entries](https://docs.astro.build/en/guides/images/#images-in-content-collections),
you can add them as markdown images.

```typescript
const { data, error } = await polar
  .upload(posts, {
    organizationId,
    organizationName,
  })
  .filter(({ exists }) => exists)
  .transform(({ entry, article }) => {
     if (entry.data.image) {
       // Add the image as a markdown image at the start of the article
       article.body = `![](${Astro.url.host}${entry.data.image.src})\n\n${article.body}`
     }
     return article
  })
```
