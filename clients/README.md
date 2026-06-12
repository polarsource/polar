# Polar Clients

## What's inside?

This [Turborepo](https://turbo.build/) includes the following packages/apps:

### Apps and Packages

- `apps/web`: [polar.sh](https://polar.sh) – [Next.js](https://nextjs.org/) app
- `apps/app`: iOS and Android app built with [Expo](https://expo.dev/) and React Native
- `apps/orbit`: Documentation and component showcase for the Orbit design system
- `packages/ui`: Shared resources
- `packages/client`: Internal API client generated from OpenAPI spec
- `packages/orbit`: Polar's design system containing components and design tokens

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
