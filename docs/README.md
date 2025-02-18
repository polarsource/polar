# Polar docs

Using Mintlify.

**Core concepts**
- `docs.json` contains [navigation](https://mintlify.com/docs/navigation/overview), [redirects](https://mintlify.com/docs/settings/broken-links) and core settings


## Development

**Installation**
```bash
pnpm install
```

**Development Server**
```bash
pnpm mintlify dev
```

## Generate API & Webhook Code Samples

```
Manual at the moment, but to be automated with GitHub Actions.
```

Mintlify & Speakeasy work great together.

Mintlify requires the `.speakeasy/workflow.yaml` to specify our code sample path
at Speakeasy and any overlays.

From there we [create manual `.mdx` pages](https://mintlify.com/docs/api-playground/openapi/setup#autogenerate-files) for each one for complete control of
how they are displayed, navigation order etc.

```bash
npx @mintlify/scraping@latest openapi-file openapi.yaml -o api-reference
```

**Generate Webhook Sample Payloads (Snippets)**

Currently, Mintlify does not support webhooks and only generates endpoints in
`paths` in the OpenAPI schema.

So we have a custom script `.polar/generate-webhooks.mts` which can be executed
like so:

```bash
pnpm generate-webhooks
```

It generates a bunch of snippets under `snippets/webhooks/<event.name>/<snippets>.mdx`
which we then use as snippets in our docs.
