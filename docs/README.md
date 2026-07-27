# Polar docs

Using Mintlify.

**Core concepts**
- `docs.json` contains [navigation](https://mintlify.com/docs/navigation/overview), [redirects](https://mintlify.com/docs/settings/broken-links) and core settings

## Development

**Installation**
```bash Terminal
pnpm install
```

**Development Server**
```bash Terminal
pnpm dev
```

### Update the OpenAPI schema

Generate a fresh public schema from the server and add Python and TypeScript code samples:

```bash Terminal
cd ../sdk/generator
just docs-openapi
```
