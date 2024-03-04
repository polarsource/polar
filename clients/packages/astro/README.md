# Polar Astro SDK

The Polar Astro SDK is an Astro library designed for interacting with the
[Polar](https://polar.sh) API.

The SDK is designed to run in both static and SSR mode, and provides wrappers the
[`@polar-sh/sdk`](https://www.npmjs.com/package/@polar-sh/sdk) package for integrating
your Astro site with Polar.

See [`astro-example`](https://github.com/polarsource/polar/tree/main/clients/examples/astro-example) for a fully working
example of how to integrate `@polar-sh/astro` with your Astro app.

## Usage

Install the SDK with your favourite package manager (ours is PNPM!):

```bash
pnpm add @polar-sh/astro
```

Then, get started by creating a Polar client with your access token:

```typescript
import { Polar } from '@polar-sh/astro';

const polar = new Polar({ accessToken });
```

Access tokens can be generated on your Polar [Settings page](https://polar.sh/settings).

### Custom frontmatter schema

The Polar Astro SDK ships with a Zod schema for defining frontmatter properties in your
Astro content collections. It contains common Polar article metadata, such as a `title`
and whether or not to `notifySubscribers` of the article.

```typescript
import { z, defineCollection } from 'astro:content';
import { polarArticleSchema } from '@polar-sh/astro';

defineCollection({
  schema: z.object({
    // Your custom frontmatter properties here...
    // ...
    polar: polarArticleSchema.optional(),
  }),
});
```

### Uploading posts to Polar

The upload module is designed to be used with
[Astro content collections](https://docs.astro.build/en/guides/content-collections/).

The upload client uses the builder pattern to transform and filter posts before
uploading them to Polar. For example, to upload all your posts with no modification:

```typescript
import { getCollection } from 'astro:content';
import { Polar } from '@polar-sh/astro';

const posts = await getCollection('blog');

const polar = new Polar({ accessToken });

const { data, error } = await polar.upload(posts, {
  organizationName,
});
```

The above code will upload all your posts to Polar, and will update any existing posts
that share a `slug` between Astro and Polar. The default parameters are as follows:

```typescript
{
  title: entry.id,
  slug: entry.slug,
  body: entry.body,
}
```

Where `entry` is an Astro collection entry object. `entry.id` usually corresponds to the
filename.

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
    organizationName,
  })
  .filter(({ exists }) => !exists);
```

##### Add a title to the posts

This assumes you have a title in your content collection frontmatter.

```typescript
const { data, error } = await polar
  .upload(posts, {
    organizationName,
  })
  .transform(
    ({
      // `entry` is the Astro collection entry
      entry,
      // `article` is the Polar article
      article,
      // `existing` is the existing Polar article, if it's been uploaded previously
      existing,
    }) => {
      article.title = entry.data.title ?? existing.title;
      return article;
    }
  );
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
      article.body = `![](${Astro.url.host}${entry.data.image.src})\n\n${article.body}`;
    }
    return article;
  });
```

##### Using the custom frontmatter schema

You can use the custom frontmatter schema directly with the upload client. This article assumes
the properties exist under a `polar` key in your frontmatter.

```typescript
const { data, error } = await polar
  .upload(posts, {
    organizationName,
  })
  .filter(({ exists }) => exists)
  .transform(({ entry, article }) => {
    article = {
      ...article,
      ...entry.data.polar,
      // `published_at` is a date and needs to be a string
      published_at: entry.data.polar?.published_at?.toISOString(),
    };
    return article;
  });
```

### Using the Polar SDK

You can also access other Polar SDK functions through the `client` property on the
`Polar` class.

```typescript
pledge = await polar.client.pledges.get({ id: 'pledge-id' });
```

## TODOs

- [x] Add Polar article upload
- [ ] Add functions for authenticating on an Astro site using Polar
  - [ ] Add helper methods for determining a user's subscription tier
- [ ] Add Polar-specific components like `<Paywall>`
  - These will probably be React components, as Polar is written in React and Astro
    supports React
- [ ] Add functionality for pulling articles from Polar to generate static or SSR
      pages on Polar sites
