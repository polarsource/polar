# Polar Clients

## What's inside?

This [Turborepo](https://turbo.build/) includes the following packages/apps:

### Apps and Packages

- `apps/web`: [polar.sh](https://polar.sh) – [Next.js](https://nextjs.org/) app
- `packages/orbit`: Polar's design system containing components, design tokens, and the `<Box />` primitive
- `packages/ui`: Legacy shared resources (being migrated to Orbit)
- `packages/client`: Internal API client generated from OpenAPI spec

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Install

```bash
pnpm install
```

### Build

To build all apps and packages, run the following command:

```bash
pnpm build
```

### Develop

```bash
pnpm dev
```

### Generate API client from OpenAPI spec

```bash
pnpm generate
```
